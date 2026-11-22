---
title: Deployed Data Engineering with DuckDB, dbt and AWS
date: 2026-11-21
author: dataGriff
description: Part three of the DuckDB series, running the same tested dbt pipeline on a laptop, on AWS Emulator and as a scheduled Fargate job on AWS without changing a line of SQL
tags:
  - DuckDB
  - dbt
  - Harlequin
  - AWS
  - AWS Emulator
  - Data Engineering
image:
  path: /assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/link.png
---

I wanted one dbt and DuckDB setup running in three environments, a laptop, AWS Emulator and real AWS, to prove how little config the same beer pipeline needs in each. My day started at the park with a sausage bap for me and an ice-cream for my dog, and I was busting to continue the dbt series with AWS Emulator, my new favourite toy. Read on fellow hungovercoder.

If you are joining here, [part 1](/blog/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin) generated a month of fake craft beer shop events as parquet files and queried them with DuckDB and Harlequin. [Part 2](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt) turned that into a dbt project called `beer_sales`, with a staging view, a daily summary table, a seeded beer list and tests, and put the location of the events behind an `EVENTS_LOCATION` variable. This post takes that dbt project and runs it, unchanged, in three places: in a container on a laptop, against AWS Emulator, and as a scheduled Fargate job on AWS.

## Pre-Requisites

- [Part 2](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt) completed, with a green `dbt build`
- [uv](https://docs.astral.sh/uv/), Docker, Terraform and the AWS CLI
- [AWS Emulator](https://github.com/aws/aws-emulator), which one of the scripts below can install for you
- An AWS account that still has its default VPC, for the real AWS half

## Three Environments

![One dbt project in three environments. A laptop, AWS Emulator and AWS each feed the same beer_sales dbt build, and the summary lands in a local file, an emulated bucket and a real bucket. Only DBT_TARGET, EVENTS_LOCATION and SUMMARY_LOCATION change](/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/three-environments.svg)

The emulator sits in the middle because a wrong bucket path or a typo in the Terraform costs nothing to find there.

## A Container and No Server

I wanted the cheapest thing that could run this in production and also run locally, and that is a container. DuckDB is embedded, so there is no database server to look after. That leaves a job that starts, runs `dbt build` and stops, and running it in production means running that container on a schedule.

From the repo root, one level above `beer_sales`, add a Dockerfile:

```dockerfile
FROM python:3.12-slim

RUN pip install --no-cache-dir uv

WORKDIR /app

# Install dependencies first so this layer is cached until the lockfile changes.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-install-project

COPY beer_sales ./beer_sales

WORKDIR /app/beer_sales
ENV DBT_PROFILES_DIR=/app/beer_sales

CMD ["uv", "run", "--frozen", "dbt", "build"]
```

A `.dockerignore` beside it keeps the data, the virtual environment and the local duckdb file out of the image:

```txt
.git
.venv
data
docs
raw_docs
**/*.duckdb
**/*.duckdb.wal
**/target
**/logs
**/dbt_packages
**/.env
**/.user.yml
```

A run of that leaves its results in `beers.duckdb` inside the container, and they go in the bin with it when the job stops. So there is one change to make to the pipeline before building anything.

## Export the Summary

Part 2 gave us [two kinds of model](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt/#dbt-directories-and-files-i-need-to-know-right-now). A view stores the query, and a table stores the results inside `beers.duckdb`. That file was the persistence we wanted on a laptop, and it is the one the container throws away. Left as it is, a successful run in AWS would leave nothing behind.

![Raw events sit in S3 as if from a source system. Without the export model the summary is a table inside the container and is lost when the job finishes. With it, the container writes daily_event_summary.parquet back to S3, where it is still there afterwards](/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/why-export.svg)

Read the picture as a source system dropping raw events into S3, the job reading them, and the summary going back to S3 for whoever needs it next. In AWS those are two folders in one bucket, `raw/events/` and `summary/`. On a laptop they are two places under `data/`. Our fake events stand in for the source system in both.

dbt-duckdb has a third kind for this, the [external materialisation](https://github.com/duckdb/dbt-duckdb). dbt runs the `select`, writes the rows to a file outside the database, and leaves a view behind that reads the file back, so anything downstream can still `ref()` it. Add `beer_sales/models/exports/daily_event_summary_export.sql`:

```sql
{{
  config(
    materialized='external',
    format='parquet',
    location=env_var('SUMMARY_LOCATION', '../data/daily_event_summary.parquet')
  )
}}

select *
from {{ ref('fct_daily_event_summary') }}
```

This model is one more step on the end of the pipeline. It takes the [daily summary mart from part 2](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt/#create-stable-views) and writes it out as one parquet file. Another tool or another DuckDB can pick that up. The mart stays a table, so the [tests](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt/#add-model-tests) and the [harlequin queries](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt/#harlequin-on-a-real-database) from part 2 carry on working.

`SUMMARY_LOCATION` decides where the file goes. It is the same trick as [`EVENTS_LOCATION` in part 2](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt/#stable-source-with-dynamic-location), pointing the other way. Left unset the file lands next to our raw data, and in AWS it is an `s3://` path. After `uv run dbt build` in `beer_sales`, this is the view dbt left in `beers.duckdb`:

```sql
CREATE VIEW beer_sales.daily_event_summary_export AS
SELECT * FROM read_parquet('../data/daily_event_summary.parquet',
  (union_by_name = CAST('f' AS BOOLEAN)));
```

The default location sits in `data/` because DuckDB writes the file but won't create a missing folder for it. With the default pointed at `../data/exports/`, the same `uv run dbt build` stops with:

```txt
IO Error: Cannot open file "../data/exports/daily_event_summary.parquet": No such file or directory
```

## On the Laptop

From the repo root, build the image and run it with the local data mounted in:

```bash
docker build -t beer-sales .
docker run --rm -v "$(pwd)/data:/app/data" beer-sales
```

```txt
Done. PASS=10 WARN=0 ERROR=0 SKIP=0 NO-OP=0 REUSED=0 TOTAL=10
```

Ten sweet sweet passes, and that is the production job running on a laptop.

Now break it on purpose, to see what a failure looks like. Part 2 [added a test](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt/#add-model-tests) that every beer in the summary has to be on our [beer list](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt/#seeding-the-beer-list), `seeds/beers.csv`. Take Dutty off that list, the same break as [When Tests Bite](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt/#when-tests-bite), and build the image again so it carries the shorter list. The events still have people buying Dutty, so the test finds a beer that is not on the list:

```bash
docker build -t beer-sales .
docker run --rm -v "$(pwd)/data:/app/data" beer-sales
echo $?
```

```txt
Done. PASS=9 WARN=0 ERROR=1 SKIP=0 NO-OP=0 REUSED=0 TOTAL=10
1
```

Nine steps passed and one failed, so dbt finishes with an error and the container exits with a `1` where a clean run gives a `0`. That exit code is how anything outside the container knows the job failed, and it is what sends an email later on.

The other thing to read is `SKIP=0`. Nothing was skipped, so the export ran even though a test on the summary failed. That test depends on the beer list as well as the summary, and dbt did not hold the export back for it. A rogue beer fails the job and its numbers still reach the summary file.

Put Dutty back and build once more before carrying on.

## A Throwaway AWS

[AWS Emulator](https://github.com/aws/aws-emulator) is one program from AWS that answers the AWS APIs on a local port, and it [came out on 11 November](https://aws.amazon.com/blogs/aws/test-your-applications-against-aws-locally-with-aws-emulator/). My [software factory template](https://github.com/hungovercoders/template-aws-api) uses it, and I wanted everything here deployed to it as well.

What can I say, I am a fairly lazy hungovercoder, and my own machine turned out not to have it installed:

```txt
zsh: command not found: aws-emulator
```

From here on I wrapped the commands in sh files and ran those. They are in the `scripts` folder of [the repo](https://github.com/hungovercoders/learn.harlequin), and each is shown in full where it first appears. The first installs and starts the emulator, in a terminal of its own:

```bash
scripts/emulator.sh start
```

<details>
<summary>All of <code>scripts/emulator.sh</code></summary>

```bash
#!/usr/bin/env bash
# Run AWS Emulator, and stand the beer sales job's infrastructure up on it.
#
#   scripts/emulator.sh start  run the emulator and leave it running; give it a terminal of its own
#   scripts/emulator.sh up     apply infra/ to the emulator, upload the events, run dbt build
#
# start uses an aws-emulator already on your PATH. Without one, on Linux and WSL it
# downloads the pinned version into .tools/ and checks AWS's signature; on macOS and
# Windows, where there is no native package, it runs the emulator in Docker.
# The emulator forgets everything when it stops, so run up again after a restart.
set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck source=scripts/emulator_env.sh
source scripts/emulator_env.sh
BUCKET=beer-sales-local

# Pinned so everyone tests against the same emulator. Versions:
# https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS/versions.json
EMULATOR_VERSION="${EMULATOR_VERSION:-1.0.545}"
EMULATOR_BASE=https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS
# The AWS publishing key that signs the emulator packages (from its user guide).
EMULATOR_KEY=98BCF336A3BE53B734E967C52E5BF49BD940F624
EMULATOR_BIN=.tools/aws-emulator/opt/aws-emulator/bin/aws-emulator

install() {
  local arch tmp package
  case "$(uname -m)" in
    x86_64) arch=amd64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *) echo "No AWS Emulator package for $(uname -m)"; exit 1 ;;
  esac
  if ! command -v dpkg-deb >/dev/null || ! command -v gpgv >/dev/null; then
    echo "Installing needs dpkg-deb and gpgv. Otherwise install AWS Emulator yourself so aws-emulator is on your PATH."
    exit 1
  fi
  tmp="$(mktemp -d)"
  package="aws-emulator_${EMULATOR_VERSION}-1_${arch}.deb"
  echo "Downloading AWS Emulator $EMULATOR_VERSION"
  curl -fsSLo "$tmp/emulator.deb" "$EMULATOR_BASE/$package"
  curl -fsSLo "$tmp/emulator.deb.sig" "$EMULATOR_BASE/$package.sig"
  curl -fsSLo "$tmp/key.asc" https://downloads.aws.com/keys/gpg/current.asc
  if ! gpg --show-keys --with-colons "$tmp/key.asc" 2>/dev/null | grep -q "^fpr:::::::::$EMULATOR_KEY:"; then
    echo "The AWS publishing key does not have the expected fingerprint"; exit 1
  fi
  gpg --dearmor < "$tmp/key.asc" > "$tmp/key.gpg"
  # The signature must be good and made by that key, not by another the key file also holds.
  gpgv --status-fd 1 --keyring "$tmp/key.gpg" "$tmp/emulator.deb.sig" "$tmp/emulator.deb" > "$tmp/status" 2>/dev/null
  if ! grep -aEq "^\\[GNUPG:\\] VALIDSIG ($EMULATOR_KEY .*|.* $EMULATOR_KEY)\$" "$tmp/status"; then
    echo "The package is not signed by the AWS publishing key"; exit 1
  fi
  rm -rf .tools/aws-emulator && mkdir -p .tools/aws-emulator
  dpkg-deb -x "$tmp/emulator.deb" .tools/aws-emulator
  rm -rf "$tmp"
  "$EMULATOR_BIN" -v
}

start() {
  if command -v aws-emulator >/dev/null; then
    exec aws-emulator -p "$EMULATOR_PORT"
  fi
  case "$(uname -s)" in
    Linux)
      if ! "$EMULATOR_BIN" -v 2>/dev/null | grep -qx "Version: $EMULATOR_VERSION"; then install; fi
      exec "$EMULATOR_BIN" -p "$EMULATOR_PORT"
      ;;
    *)
      local arch package
      case "$(uname -m)" in arm64 | aarch64) arch=aarch64 ;; *) arch=x86_64 ;; esac
      package="aws-emulator-${EMULATOR_VERSION}-1-${arch}.rpm"
      docker build -t aws-emulator --build-arg "PACKAGE=$package" -f scripts/emulator.Dockerfile scripts
      # The emulator writes this run's credentials and certificate under HOME, so
      # the container shares that folder with the tools out here.
      mkdir -p "$HOME/.aws/emulator"
      exec docker run --rm --memory=2g --memory-swap=2g \
        -p "127.0.0.1:$EMULATOR_PORT:$EMULATOR_PORT" \
        -e HOME="$HOME" -v "$HOME/.aws/emulator:$HOME/.aws/emulator" \
        aws-emulator -p "$EMULATOR_PORT"
      ;;
  esac
}

up() {
  if [ ! -f "$AWS_CA_BUNDLE" ]; then
    echo "No emulator found on port $EMULATOR_PORT. Start one in another terminal first: scripts/emulator.sh start"
    exit 1
  fi
  if [ ! -d data/raw/events ]; then
    uv run python scripts/generate_fake_events.py
  fi
  # A fresh emulator knows nothing about the last one's resources.
  rm -f infra/emulator.tfstate infra/emulator.tfstate.backup
  terraform -chdir=infra init -input=false
  terraform -chdir=infra apply -auto-approve -input=false -state=emulator.tfstate \
    -var "bucket_name=$BUCKET" -var "region=$AWS_REGION"
  aws s3 sync data/raw/events "s3://$BUCKET/raw/events/" --delete --only-show-errors
  (
    cd beer_sales
    export DBT_PROFILES_DIR="$PWD" DBT_TARGET=emulator
    export EVENTS_LOCATION="s3://$BUCKET/raw/events/*.parquet"
    export SUMMARY_LOCATION="s3://$BUCKET/summary/daily_event_summary.parquet"
    uv run dbt build
  )
  echo
  echo "The emulator has the stack, the events and the summary. Next: scripts/three_environments.sh"
}

case "${1:-}" in
  start) start ;;
  up) up ;;
  *) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
```

</details>

<details>
<summary>All of <code>scripts/emulator_env.sh</code></summary>

```bash
# Source this to point the AWS CLI, Terraform and dbt at a running AWS Emulator:
#   source scripts/emulator_env.sh
# The emulator writes this run's credentials, config and certificate to its home folder.
EMULATOR_PORT="${EMULATOR_PORT:-9297}"
EMULATOR_DIR="$HOME/.aws/emulator/$EMULATOR_PORT"

export AWS_ENDPOINT_URL="https://127.0.0.1:$EMULATOR_PORT"
export AWS_SHARED_CREDENTIALS_FILE="$EMULATOR_DIR/emulator_credentials"
export AWS_CONFIG_FILE="$EMULATOR_DIR/config"
export AWS_CA_BUNDLE="$EMULATOR_DIR/ca.pem"
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1
export AWS_EC2_METADATA_DISABLED=true
export AWS_DISABLE_HOST_PREFIX_INJECTION=true

# Real credentials in the shell would win over the emulator's, so they go.
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE
```

</details>

It uses an `aws-emulator` already on your PATH. Without one, on a Debian-style Linux or WSL it downloads a pinned version and checks AWS's signature on it, and on macOS or Windows it runs the emulator in Docker. dbt then needs a second target in `profiles.yml`:

```yaml
    emulator:
      type: duckdb
      path: beers.duckdb
      schema: beer_sales
      threads: 4
      extensions:
        - parquet
        - httpfs
        - aws
      settings:
        # DuckDB does not read AWS_CA_BUNDLE, so it is told where the emulator's certificate is.
        ca_cert_file: "{{ env_var('AWS_CA_BUNDLE', '') }}"
      secrets:
        - type: s3
          provider: credential_chain
          region: "{{ env_var('AWS_REGION', 'us-east-1') }}"
          endpoint: "{{ env_var('EMULATOR_HOST', '127.0.0.1:9297') }}"
          url_style: path
          use_ssl: true
```

`httpfs` reads and writes `s3://` paths, and `credential_chain` finds credentials the way the AWS CLI does, so there are no keys in the file.

The infrastructure is one Terraform file, `infra/main.tf`, written for real AWS and applied to the emulator unchanged. This is what it describes:

![The deployed job in AWS. A schedule starts a Fargate task that pulls its image from ECR, reads events from S3 and writes the summary back, and logs to CloudWatch. A failure goes through an EventBridge rule and an SNS topic to an email](/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/aws-deployment.svg)

The task's role is allowed to read the events and write the summary, with no delete and no other bucket named.

<details>
<summary>All of <code>infra/main.tf</code></summary>

```hcl
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    awscc = {
      source  = "hashicorp/awscc"
      version = "~> 1.0"
    }
  }
}

provider "aws" {
  region = var.region

  # Every resource that can carry tags gets these, which is what the resource group below finds.
  default_tags {
    tags = local.tags
  }
}

provider "awscc" {
  region = var.region
}

variable "region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-west-2"
}

variable "bucket_name" {
  description = "Name for the S3 bucket holding raw events and the summary export; leave empty for one made from the account id and region"
  type        = string
  default     = ""
}

variable "image_tag" {
  description = "Tag of the image in ECR that the task runs"
  type        = string
  default     = "latest"
}

variable "schedule" {
  description = "EventBridge Scheduler expression for the dbt build"
  type        = string
  default     = "cron(0 6 * * ? *)"
}

variable "environment" {
  description = "Which environment this is, used as a tag on every resource"
  type        = string
  default     = "production"
}

variable "alert_email" {
  description = "Email address told when the job fails; leave empty to create the topic with no subscriber"
  type        = string
  default     = ""
}

data "aws_caller_identity" "current" {}

locals {
  name = "beer-sales"
  tags = {
    project     = local.name
    environment = var.environment
    managed-by  = "terraform"
  }
  # Bucket names are global. The account id and region make one nobody else has.
  bucket           = var.bucket_name != "" ? var.bucket_name : "${local.name}-${data.aws_caller_identity.current.account_id}-${var.region}"
  events_location  = "s3://${local.bucket}/raw/events/*.parquet"
  summary_location = "s3://${local.bucket}/summary/daily_event_summary.parquet"
}

# --- One place to see it all -------------------------------------------------
# A resource group is a saved search: everything tagged as this project in this
# environment, on one page of the console.

resource "aws_resourcegroups_group" "this" {
  name        = "${local.name}-${var.environment}"
  description = "Everything that makes up the beer sales dbt job in ${var.environment}"

  resource_query {
    query = jsonencode({
      ResourceTypeFilters = ["AWS::AllSupported"]
      TagFilters = [
        { Key = "project", Values = [local.name] },
        { Key = "environment", Values = [var.environment] },
      ]
    })
  }
}

# --- Storage -----------------------------------------------------------------

# Made through Cloud Control rather than aws_s3_bucket, which reads the bucket's
# tags through S3 Control. AWS Emulator does not serve that, so the plain
# resource never finishes there. This one applies to the emulator and to AWS.
# It has no force_destroy: empty the bucket before a terraform destroy.
resource "awscc_s3_bucket" "data" {
  bucket_name = local.bucket
  # Cloud Control has no default tags: they are given by name.
  tags = [for key, value in local.tags : { key = key, value = value }]
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket                  = awscc_s3_bucket.data.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- Image and logs ----------------------------------------------------------

resource "aws_ecr_repository" "job" {
  name         = local.name
  force_delete = true
}

resource "aws_cloudwatch_log_group" "job" {
  name              = "/ecs/${local.name}"
  retention_in_days = 14
}

# --- IAM ---------------------------------------------------------------------

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Lets ECS pull the image and write logs. Nothing to do with our data.
resource "aws_iam_role" "execution" {
  name               = "${local.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# What dbt runs as: read raw events, read and write the summary, nothing else.
resource "aws_iam_role" "task" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "task" {
  statement {
    actions   = ["s3:ListBucket"]
    resources = [awscc_s3_bucket.data.arn]
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["raw/events/*", "summary/*"]
    }
  }

  statement {
    actions   = ["s3:GetObject"]
    resources = ["${awscc_s3_bucket.data.arn}/raw/events/*"]
  }

  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:AbortMultipartUpload"]
    resources = ["${awscc_s3_bucket.data.arn}/summary/*"]
  }
}

resource "aws_iam_role_policy" "task" {
  name   = "s3-least-privilege"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}

# --- The job -----------------------------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = local.name
}

resource "aws_ecs_task_definition" "job" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "dbt"
      image     = "${aws_ecr_repository.job.repository_url}:${var.image_tag}"
      essential = true
      environment = [
        { name = "DBT_TARGET", value = "s3" },
        { name = "AWS_REGION", value = var.region },
        { name = "EVENTS_LOCATION", value = local.events_location },
        { name = "SUMMARY_LOCATION", value = local.summary_location },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.job.name
          awslogs-region        = var.region
          awslogs-stream-prefix = "dbt"
        }
      }
    }
  ])
}

# --- Networking: the default VPC, outbound only ------------------------------

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "job" {
  name        = local.name
  description = "Outbound only for the beer sales dbt job"
  vpc_id      = data.aws_vpc.default.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# --- Schedule ----------------------------------------------------------------

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${local.name}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
}

data "aws_iam_policy_document" "scheduler" {
  statement {
    actions   = ["ecs:RunTask"]
    resources = ["${aws_ecs_task_definition.job.arn_without_revision}:*"]
    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = [aws_ecs_cluster.this.arn]
    }
  }

  statement {
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.execution.arn, aws_iam_role.task.arn]
  }
}

resource "aws_iam_role_policy" "scheduler" {
  name   = "run-task"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler.json
}

resource "aws_scheduler_schedule" "job" {
  name                = local.name
  schedule_expression = var.schedule

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_ecs_cluster.this.arn
    role_arn = aws_iam_role.scheduler.arn

    ecs_parameters {
      task_definition_arn = aws_ecs_task_definition.job.arn_without_revision
      launch_type         = "FARGATE"

      network_configuration {
        # A public IP lets the task reach ECR and S3 without a NAT gateway.
        assign_public_ip = true
        subnets          = data.aws_subnets.default.ids
        security_groups  = [aws_security_group.job.id]
      }
    }
  }
}

# --- Failure notifications ---------------------------------------------------
# dbt build exits non-zero when a model or test fails, so the container's exit
# code is the signal. A task that never started has no exit code, only a stop code.

resource "aws_sns_topic" "alerts" {
  name = "${local.name}-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  count = var.alert_email == "" ? 0 : 1

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_event_rule" "job_failed" {
  name        = "${local.name}-failed"
  description = "The beer sales dbt job stopped with a non-zero exit code or failed to start"

  event_pattern = jsonencode({
    source      = ["aws.ecs"]
    detail-type = ["ECS Task State Change"]
    detail = {
      clusterArn = [aws_ecs_cluster.this.arn]
      lastStatus = ["STOPPED"]
      "$or" = [
        { containers = { exitCode = [{ anything-but = 0 }] } },
        { stopCode = ["TaskFailedToStart"] },
      ]
    }
  })
}

resource "aws_cloudwatch_event_target" "job_failed" {
  rule = aws_cloudwatch_event_rule.job_failed.name
  arn  = aws_sns_topic.alerts.arn

  input_transformer {
    input_paths = {
      task   = "$.detail.taskArn"
      code   = "$.detail.stopCode"
      reason = "$.detail.stoppedReason"
    }
    input_template = "\"The beer-sales dbt job failed. Stop code: <code>. Reason: <reason>. Task: <task>. Logs are in the ${aws_cloudwatch_log_group.job.name} log group.\""
  }
}

data "aws_iam_policy_document" "alerts" {
  statement {
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.alerts.arn]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.job_failed.arn]
    }
  }
}

resource "aws_sns_topic_policy" "alerts" {
  arn    = aws_sns_topic.alerts.arn
  policy = data.aws_iam_policy_document.alerts.json
}

# --- Outputs -----------------------------------------------------------------

output "bucket" {
  value = awscc_s3_bucket.data.bucket_name
}

output "resource_group" {
  value = aws_resourcegroups_group.this.name
}

output "cluster" {
  value = aws_ecs_cluster.this.name
}

output "log_group" {
  value = aws_cloudwatch_log_group.job.name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.job.repository_url
}

output "alerts_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

output "events_location" {
  value = local.events_location
}

output "summary_location" {
  value = local.summary_location
}

output "run_task_command" {
  description = "Kick the job off by hand instead of waiting for the schedule"
  value = join(" ", [
    "aws ecs run-task",
    "--region ${var.region}",
    "--cluster ${aws_ecs_cluster.this.name}",
    "--task-definition ${aws_ecs_task_definition.job.family}",
    "--launch-type FARGATE",
    "--network-configuration 'awsvpcConfiguration={subnets=[${join(",", data.aws_subnets.default.ids)}],securityGroups=[${aws_security_group.job.id}],assignPublicIp=ENABLED}'",
  ])
}
```

</details>

One command applies that Terraform to the emulator, uploads the events and runs the build against it:

```bash
scripts/emulator.sh up
```

```txt
Apply complete! Resources: 19 added, 0 changed, 0 destroyed.
Done. PASS=10 WARN=0 ERROR=0 SKIP=0 NO-OP=0 REUSED=0 TOTAL=10
```

That is nineteen resources and a green build against a bucket, with the SQL from part 2 untouched. The container runs against the emulator as well. Build the image again to pick up the new target, and give it the emulator's certificate and credentials. This form is for Linux, where `--network host` reaches the emulator:

```bash
docker build -t beer-sales .
docker run --rm --network host \
  -e DBT_TARGET=emulator -e AWS_REGION=us-east-1 \
  -e AWS_CA_BUNDLE=/emulator/ca.pem \
  -e AWS_SHARED_CREDENTIALS_FILE=/emulator/emulator_credentials \
  -e EVENTS_LOCATION="s3://beer-sales-local/raw/events/*.parquet" \
  -e SUMMARY_LOCATION="s3://beer-sales-local/summary/daily_event_summary.parquet" \
  -v "$HOME/.aws/emulator/9297:/emulator:ro" beer-sales
```

```txt
Done. PASS=10 WARN=0 ERROR=0 SKIP=0 NO-OP=0 REUSED=0 TOTAL=10
```

### What the Emulator Would Not Do

One thing in the Terraform had to give, and one problem went away with a newer emulator. A plain `aws_s3_bucket` never finished creating, so the bucket is an `awscc_s3_bucket`, which works on both:

```txt
aws_s3_bucket.data: Still creating... [01m30s elapsed]
```

Both make the same bucket. The plain one uses the standard AWS provider, which hangs on the emulator. My API template's [notes](https://github.com/hungovercoders/template-aws-api/blob/main/docs/testing.md) put that down to a tags call through S3 Control, which the emulator does not serve. The [`awscc` one](https://registry.terraform.io/providers/hashicorp/awscc/latest/docs/resources/s3_bucket) goes through Cloud Control, which it does. The price is no `force_destroy`, so the bucket has to be emptied before Terraform can delete it.

On emulator 1.0.365 the security group's outbound rule failed like this:

```txt
Error: updating Security Group egress rules: operation error EC2:
AuthorizeSecurityGroupEgress, api error InvalidPermission.Duplicate:
the specified rule "peer: 0.0.0.0/0, ALL, ALLOW" already exists
```

On 1.0.545 the same Terraform applies.

I also wanted the job itself to run there. Three ways in all failed:

```txt
$ docker push 127.0.0.1:9297/beer-sales:latest
error from registry: the operation is unsupported

$ aws ecs run-task ...   # image python:3.12-slim, command cat /etc/os-release
cat: /etc/os-release: No such file or directory

$ aws lambda invoke ...  # a python3.12 function returning sys.version and os.getcwd()
3.12.0 [RustPython 0.6.0 with rustc 1.99.1]
OSError(38, 'a Lambda function in this emulator has no host filesystem to reach')
```

The emulator answers the AWS APIs. It does not run what is inside an image, and its [README](https://github.com/aws/aws-emulator) says not to test security on it. So the emulator stands in for S3 and takes the Terraform, and the container still needs Docker to run it.

## The Real Thing

Real AWS needs a third target in `profiles.yml`. It is the same as the emulator target, without the endpoint and certificate settings that pointed that one at the emulator:

```yaml
    s3:
      type: duckdb
      path: beers.duckdb
      schema: beer_sales
      threads: 4
      extensions:
        - parquet
        - httpfs
        - aws
      secrets:
        - type: s3
          provider: credential_chain
          region: "{{ env_var('AWS_REGION', 'eu-west-2') }}"
```

On a laptop `credential_chain` finds your AWS login, and inside Fargate it finds the task's role. The Terraform is the same file the emulator took.

A second sh file wraps the real account. Log in to AWS first. `deploy` applies the Terraform, which stops to ask for a `yes`, then pushes the image and uploads the events. `run` starts the task, waits for it and prints its log. Use your own address for the alert, and confirm the subscription email AWS sends or it has nowhere to go:

```bash
export ALERT_EMAIL=me@example.com
scripts/aws.sh deploy
scripts/aws.sh run
```

<details>
<summary>All of <code>scripts/aws.sh</code></summary>

```bash
#!/usr/bin/env bash
# Deploy, run, break and remove the beer sales job on a real AWS account.
# Log in to AWS first, then from anywhere in the repo:
#
#   scripts/aws.sh deploy    infrastructure, image and events
#   scripts/aws.sh run       run the job now, wait for it, show its log and the summary file
#   scripts/aws.sh break     ship an image with a failing test and run it, to prove the alert
#   scripts/aws.sh fix       ship the good image again
#   scripts/aws.sh resources list everything in the environment's resource group
#   scripts/aws.sh query     ask the summary in S3 which beers are paying the bills
#   scripts/aws.sh destroy   empty the bucket and remove everything
#
# Optional settings, as environment variables:
#   AWS_REGION    where to deploy (default eu-west-2)
#   ALERT_EMAIL   who is told when the job fails; give it on every deploy
#   BUCKET_NAME   a bucket name of your own (default beer-sales-<account id>-<region>)
#
# The report from run and break has the account id and alert email swapped for
# stand-ins, so it is safe to screenshot. Terraform and docker output is not.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "${AWS_ENDPOINT_URL:-}" ]; then
  echo "AWS_ENDPOINT_URL is set ($AWS_ENDPOINT_URL), so this shell is pointed at an emulator."
  echo "Open a fresh terminal for the real account."
  exit 1
fi

REGION="${AWS_REGION:-eu-west-2}"
export AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION" AWS_PAGER=""
VARS=(-var "region=$REGION" -var "alert_email=${ALERT_EMAIL:-}")
if [ -n "${BUCKET_NAME:-}" ]; then VARS+=(-var "bucket_name=$BUCKET_NAME"); fi

tf() { terraform -chdir=infra "$@"; }
out() { tf output -raw "$1"; }

account() { aws sts get-caller-identity --query Account --output text; }

# What this script prints ends up in screenshots, so the account id and the
# alert email are swapped for stand-ins on the way out.
scrub() {
  local id
  id="$(account)"
  if [ -n "${ALERT_EMAIL:-}" ]; then
    sed -e "s/$id/123456789012/g" -e "s/$ALERT_EMAIL/me@example.com/g"
  else
    sed -e "s/$id/123456789012/g"
  fi
}

whoami_aws() {
  local id
  id="$(account)"
  # Enough to tell accounts apart, not enough to give one away.
  echo "AWS account ending ${id: -4}, region $REGION"
}

push_image() {
  local repo
  repo="$(out ecr_repository_url)"
  aws ecr get-login-password | docker login --username AWS --password-stdin "${repo%%/*}"
  # The task runs on x86, whatever this machine is.
  docker build --platform linux/amd64 -t "$repo:latest" .
  docker push "$repo:latest"
}

deploy() {
  whoami_aws
  tf init -input=false
  tf apply "${VARS[@]}"
  push_image
  # The same events as the laptop and the emulator, so all three can be compared.
  if [ ! -d data/raw/events ]; then
    uv run python scripts/generate_fake_events.py
  fi
  aws s3 sync data/raw/events "s3://$(out bucket)/raw/events/" --delete --only-show-errors
  echo
  echo "Deployed. Bucket: $(out bucket)" | scrub
  if [ -n "${ALERT_EMAIL:-}" ]; then
    echo "Confirm the subscription email AWS sent you, or no alerts will arrive."
  else
    echo "No ALERT_EMAIL was given, so nobody is told when the job fails."
  fi
  echo "Next: scripts/aws.sh run"
}

run() {
  local cluster group bucket task id status code
  cluster="$(out cluster)"
  group="$(out log_group)"
  bucket="$(out bucket)"
  task="$(eval "$(out run_task_command) --query 'tasks[0].taskArn' --output text")"
  id="${task##*/}"
  echo "Started task $id - waiting for it to finish, usually a minute or two"
  aws ecs wait tasks-stopped --cluster "$cluster" --tasks "$task"

  status="$(aws ecs describe-tasks --cluster "$cluster" --tasks "$task" \
    --query 'tasks[0].[stopCode,stoppedReason]' --output text)"
  code="$(aws ecs describe-tasks --cluster "$cluster" --tasks "$task" \
    --query 'tasks[0].containers[0].exitCode' --output text)"

  {
    echo
    echo "--- dbt log ($group) ---"
    aws logs get-log-events --log-group-name "$group" --log-stream-name "dbt/dbt/$id" \
      --start-from-head --query 'events[].message' --output text 2>/dev/null | tr '\t' '\n' \
      || echo "(no log stream - the task never started)"
    echo
    echo "--- summary in s3://$bucket/summary/ ---"
    aws s3 ls "s3://$bucket/summary/" || echo "(nothing there yet)"
    echo
    echo "Task stopped: $status"
  } | scrub
  if [ "$code" = "0" ]; then
    echo "Exit code 0 - the job passed"
  else
    echo "Exit code $code - the job failed"
    return 1
  fi
}

break_it() {
  local seed=beer_sales/seeds/beers.csv keep
  keep="$(mktemp)"
  cp "$seed" "$keep"
  # Whatever happens next, the beer list goes back as it was.
  # shellcheck disable=SC2064 # expand the paths now: they are local to this function
  trap "cp '$keep' '$seed'; rm -f '$keep'" EXIT
  grep -v '^Dutty$' "$keep" > "$seed"
  echo "Dutty is off the beer list - shipping an image that fails its test"
  push_image
  cp "$keep" "$seed"
  run || true
  echo
  echo "That failure should reach the alert email within a few minutes."
  echo "Next: scripts/aws.sh fix"
}

resources() {
  local group
  group="$(out resource_group)"
  echo "--- resource group $group ---"
  aws resource-groups list-group-resources --group-name "$group" \
    --query 'Resources[].Identifier.[ResourceType,ResourceArn]' --output text | sort \
    | awk -F'\t' '{ printf "%-27s %s\n", $1, $2 }' | scrub
}

query() {
  local location sql
  location="$(out summary_location)"
  sql="select beer, sum(event_count) as purchases, round(sum(revenue), 2) as revenue
from read_parquet('$location')
where event_type = 'purchase'
group by beer
order by revenue desc"
  {
    echo "--- beer revenue, read straight from $location ---"
    echo "$sql"
    echo
  } | scrub
  (
    # DuckDB finds credentials the way the AWS CLI does. Handing it this
    # shell's own makes that true for an SSO login as well.
    eval "$(aws configure export-credentials --format env 2>/dev/null)" || true
    uv run hsql -c "install httpfs; load httpfs; install aws; load aws;
      create or replace secret aws_s3 (type s3, provider credential_chain, region '$REGION'${S3_SECRET_OPTIONS:-});
      $sql"
  ) | sed '1,4{/^ Success$/d;/^-*$/d;/^ true$/d;/^(1 row)$/d;}' | scrub
}

destroy() {
  whoami_aws
  aws s3 rm "s3://$(out bucket)" --recursive --only-show-errors
  tf destroy "${VARS[@]}"
}

case "${1:-}" in
  deploy) deploy ;;
  run) run ;;
  break) break_it ;;
  fix) push_image; echo "The good image is back. Next: scripts/aws.sh run" ;;
  resources) resources ;;
  query) query ;;
  destroy) destroy ;;
  *) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
```

</details>

If you use mise, Terraform needs a version pinned or the deploy stops here:

```txt
mise ERROR No version is set for shim: terraform
```

The repo pins it in `mise.toml`. With that in place, this is a run against a real account:

![The dbt build log from the Fargate task, with ten of ten steps passing against the s3 target, followed by daily_event_summary.parquet listed in the bucket's summary folder and the task stopping with exit code 0](/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/fargate_run.png)

It passed ten of ten with `target='s3'`. The image pulled, the role was allowed what it needed and the summary landed in the bucket.

I started every run by hand. The 06:00 UTC schedule is the one piece I have not seen fire.

### One Page for the Lot

I wanted to see everything as one environment in AWS, so every resource that can carry tags gets `project` and `environment` tags, and a resource group gathers them:

![The beer-sales-production resource group in the AWS console listing nine resources across ECS, ECR, EC2, Events, Logs, Resource Groups, S3 and SNS in eu-west-2, with the group's tags managed-by terraform, project beer-sales and environment production](/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/resource_group.png)

Terraform counted nineteen on the emulator, and twenty on the real account with the email subscription, because it includes policies and attachments. The group lists nine, and the three IAM roles and the schedule are not among them.

### Told When it Fails

A rule watches for the task stopping with anything other than a zero, or failing to start, and publishes to the SNS topic. To prove it, ship an image with Dutty missing:

```bash
scripts/aws.sh break
```

![The dbt build log from a Fargate task where the seed loads seven beers instead of eight, the relationships test on the mart fails with 2572 results, the export model still runs, and the task stops with exit code 1](/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/fargate_fail.png)

The summary file in that capture is timed 18:43:35, the second the failing run finished. The export still ran, as it did on the laptop.

At 18:44 this was in my inbox:

![The alert email from AWS Notifications, timed 18:44, reading: The beer-sales dbt job failed. Stop code: EssentialContainerExited. Reason: Essential container in task exited. Task: an ECS task ARN in eu-west-2. Logs are in the /ecs/beer-sales log group](/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/failure_email.png)

Afterwards `scripts/aws.sh fix` ships the good image again, so the 06:00 UTC run does not fail every morning.

## One Query in Three Places

I wanted one picture of all three environments answering the same query. `scripts/three_environments.sh` asks the summary file which beers are paying the bills, on the laptop, in the emulator's bucket and in the real one, then compares the answers. It wants the emulator still running and a shell logged in to the real account:

```bash
scripts/three_environments.sh
```

<details>
<summary>All of <code>scripts/three_environments.sh</code></summary>

```bash
#!/usr/bin/env bash
# Ask the same question of the same pipeline in all three environments, and say whether
# the answers match: the laptop's file, AWS Emulator's S3 and real S3.
#
#   scripts/three_environments.sh
#
# Run it from a shell logged in to the real account. An environment that is not up is
# skipped. Account ids are swapped for stand-ins, so the output is safe to screenshot.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "${AWS_ENDPOINT_URL:-}" ]; then
  echo "AWS_ENDPOINT_URL is set, so this shell is pointed at an emulator."
  echo "Open a fresh terminal logged in to the real account; the emulator is reached from here anyway."
  exit 1
fi

REGION="${AWS_REGION:-eu-west-2}"
export AWS_PAGER=""
answers="$(mktemp -d)"
trap 'rm -rf "$answers"' EXIT

sql() {
  echo "select beer, sum(event_count) as purchases, round(sum(revenue), 2) as revenue
from read_parquet('$1')
where event_type = 'purchase'
group by beer
order by revenue desc"
}

# hsql prints the result of making the secret as well; that table goes.
table_only() { sed '1,4{/^ Success$/d;/^-*$/d;/^ true$/d;/^(1 row)$/d;}'; }

ask() { # name, setup SQL, location
  uv run hsql -c "$2 $(sql "$3")" 2>/dev/null | table_only | tee "$answers/$1"
}

echo "Which beers are paying the bills? One query, three places."

echo
echo "=== 1. My laptop ==="
local_file=data/daily_event_summary.parquet
if [ -f "$local_file" ]; then
  echo "    $local_file"
  ask laptop "" "$local_file"
else
  echo "    skipped: no $local_file - run dbt build in beer_sales first"
fi

echo
echo "=== 2. AWS Emulator ==="
(
  # shellcheck source=scripts/emulator_env.sh
  source scripts/emulator_env.sh
  location="s3://beer-sales-local/summary/daily_event_summary.parquet"
  if [ -f "$AWS_CA_BUNDLE" ] && aws s3 ls "$location" >/dev/null 2>&1; then
    echo "    $location on 127.0.0.1:$EMULATOR_PORT"
    ask emulator "install httpfs; load httpfs; install aws; load aws;
      set ca_cert_file='$AWS_CA_BUNDLE';
      create or replace secret emulator (type s3, provider credential_chain, region '$AWS_REGION',
        endpoint '127.0.0.1:$EMULATOR_PORT', url_style 'path', use_ssl true);" "$location"
  else
    echo "    skipped: no emulator with a summary - run scripts/emulator.sh up"
  fi
)

echo
echo "=== 3. AWS ($REGION) ==="
(
  export AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION"
  if location="$(terraform -chdir=infra output -raw summary_location 2>/dev/null)" \
    && account="$(aws sts get-caller-identity --query Account --output text 2>/dev/null)" \
    && aws s3 ls "$location" >/dev/null 2>&1; then
    echo "    ${location//$account/123456789012}"
    # DuckDB finds credentials the way the AWS CLI does. Handing it this
    # shell's own makes that true for an SSO login as well.
    eval "$(aws configure export-credentials --format env 2>/dev/null)" || true
    ask aws "install httpfs; load httpfs; install aws; load aws;
      create or replace secret aws_s3 (type s3, provider credential_chain, region '$REGION');" "$location"
  else
    echo "    skipped: nothing deployed in this account - run scripts/aws.sh deploy and run"
  fi
)

echo
count="$(find "$answers" -type f | wc -l | tr -d ' ')"
different="$(cat "$answers"/* 2>/dev/null | sort | uniq -c | awk -v n="$count" '$1 != n' | wc -l | tr -d ' ')"
if [ "$count" -lt 2 ]; then
  echo "Only $count environment answered, so there is nothing to compare."
elif [ "$different" = "0" ]; then
  echo "Same answer in all $count environments."
else
  echo "The environments disagree - they are not looking at the same events."
  exit 1
fi
```

</details>

The three environments it compares were built by the three targets in one file:

<details>
<summary>All of <code>beer_sales/profiles.yml</code></summary>

```yaml
beer_sales:
  target: "{{ env_var('DBT_TARGET', 'local') }}"
  outputs:
    local:
      type: duckdb
      path: beers.duckdb
      schema: beer_sales
      threads: 4
      extensions:
        - parquet
    emulator:
      type: duckdb
      path: beers.duckdb
      schema: beer_sales
      threads: 4
      extensions:
        - parquet
        - httpfs
        - aws
      settings:
        # DuckDB does not read AWS_CA_BUNDLE, so it is told where the emulator's certificate is.
        ca_cert_file: "{{ env_var('AWS_CA_BUNDLE', '') }}"
      secrets:
        - type: s3
          provider: credential_chain
          region: "{{ env_var('AWS_REGION', 'us-east-1') }}"
          endpoint: "{{ env_var('EMULATOR_HOST', '127.0.0.1:9297') }}"
          url_style: path
          use_ssl: true
    s3:
      type: duckdb
      path: beers.duckdb
      schema: beer_sales
      threads: 4
      extensions:
        - parquet
        - httpfs
        - aws
      secrets:
        - type: s3
          provider: credential_chain
          region: "{{ env_var('AWS_REGION', 'eu-west-2') }}"
```

</details>

<video autoplay loop muted playsinline controls>
  <source src="/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/same-answer-in-three-environments.mp4" type="video/mp4">
  <source src="/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/same-answer-in-three-environments.webm" type="video/webm">
  <img src="/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/same-answer-in-three-environments.gif" alt="A terminal recording of scripts/three_environments.sh. The beer revenue query runs against the summary file on the laptop, in the AWS Emulator bucket on 127.0.0.1 and in the real S3 bucket in eu-west-2. Each returns the same eight rows, with Clwb Tropica top at 887 purchases and 33624.22 revenue, and the last line reads Same answer in all 3 environments">
</video>

Clwb Tropica is top of the pile in all three, with the same purchases and the same revenue to the penny, and [hsql from part 1](/blog/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/#hsql) doing the asking.

## Tidy Up

Take it all down before the next round. One command empties the bucket and removes everything, and Ctrl+C stops the emulator:

```bash
scripts/aws.sh destroy
```

## What I Make of It

It's a bit messy still, but the emulator is great for getting more production-like testing done locally. It's a shame a container can't be registered in its registry so that everything runs in an emulated environment, and no other service fitted either.

One `profiles.yml` holds a target for each environment, and three variables pick between them. `DBT_TARGET` chooses the target, `EVENTS_LOCATION` says where the events are, and `SUMMARY_LOCATION` says where the summary goes. The emulator also needs its own certificate and credentials.

[Fargate bills](https://aws.amazon.com/fargate/pricing/) while a task runs and not while it doesn't, and there is no server to patch. That's some money I can put in the back burner instead.

It has two limits as it stands. The image downloads duckdb's extensions every time it starts, so each run depends on that download working. And each run overwrites the same summary file, so there is no history to go back to. A real setup would write a dated file per run.

If I did it again I'd use a script runner like Taskfile, as I usually do, in place of the sh files. I'd also have a GitHub Action for CI that runs against the emulator and then deploys. That's my next post in this series, so watch this space. I'll likely follow that with one that automates the whole process from an ODCS data contract with skills.

## Sources and Further Reading

- The code, at [github.com/hungovercoders/learn.harlequin](https://github.com/hungovercoders/learn.harlequin)
- [Part 1](/blog/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin) and [part 2](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt) of this series
- The AWS Emulator [launch post](https://aws.amazon.com/blogs/aws/test-your-applications-against-aws-locally-with-aws-emulator/), its [repo](https://github.com/aws/aws-emulator) and its [user guide](https://docs.aws.amazon.com/emulator/latest/userguide/what-is-service.html)
- [dbt-duckdb](https://github.com/duckdb/dbt-duckdb), for the external materialisation and the S3 secrets
- [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/)

Well done fellow hungovercoder, crack open a can.
