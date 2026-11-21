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

I wanted three environments for my one dbt and DuckDB setup, a laptop, AWS Emulator and real AWS, to prove how little config it takes to run the same beer pipeline in each. My day started at the park with a sausage bap for me and an ice-cream for my dog. As well as improving my recent API template I was busting to continue the dbt series and introduce another environment with AWS Emulator, my new favourite toy. This builds on [part 1](/blog/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin) and [part 2](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt) and sticks to the basics. Read on fellow hungovercoder.

A quick recap if you are joining here. [Part 1](/blog/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin) generated a month of fake craft beer shop events as parquet files and queried them with DuckDB and Harlequin. [Part 2](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt) turned that into a dbt project called `beer_sales`, with a staging view, a daily summary table, a seeded beer list and tests, and put the location of the events behind an `EVENTS_LOCATION` variable.

## Pre-Requisites

- [Part 2](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt) completed, with a green `dbt build`
- [uv](https://docs.astral.sh/uv/), Docker, Terraform and the AWS CLI
- [AWS Emulator](https://github.com/aws/aws-emulator), which one of the scripts below installs for you
- An AWS account, for the last step only

## Three Environments

```txt
laptop      data/raw/events/
emulator    s3:// on 127.0.0.1
AWS         s3:// in eu-west-2
                  |
        source('raw','events')
                  |
             stg_events
                  |
      fct_daily_event_summary
                  |
     daily_event_summary_export
```

The only things that change from one environment to the next are where the parquet lives and who starts the container. The emulator sits in the middle because a wrong bucket path or a typo in the Terraform costs nothing to find there.

## Export the Summary

Part 2 gave us two kinds of model. A view stores the query, and a table stores the results inside `beers.duckdb`. That file was the persistence we wanted on a laptop. A deployed job is gone the moment it finishes and the duckdb file goes with it, so the results need writing somewhere that outlives the job.

dbt-duckdb has a third kind for this, the [external materialisation](https://github.com/duckdb/dbt-duckdb). dbt runs the `select`, writes the rows to a file outside the database, and leaves a view behind that reads the file back, so anything downstream can still `ref()` it. Add `models/exports/daily_event_summary_export.sql`:

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

This model is one more step on the end of the pipeline. It takes the daily summary mart from part 2 and writes it out as one parquet file, which is the thing another tool or another DuckDB can pick up. The mart stays a table, so the tests and the harlequin queries from part 2 carry on working.

`SUMMARY_LOCATION` decides where the file goes. It is the same trick as `EVENTS_LOCATION`, pointing the other way. Left unset the file lands next to our raw data, and in AWS it is an `s3://` path. After a local build this is the view dbt left in `beers.duckdb`:

```sql
CREATE VIEW beer_sales.daily_event_summary_export AS
SELECT * FROM read_parquet('../data/daily_event_summary.parquet',
  (union_by_name = CAST('f' AS BOOLEAN)));
```

The default location sits in `data/` because DuckDB writes the file but won't create a missing folder for it:

```txt
IO Error: Cannot open file "../data/exports/daily_event_summary.parquet": No such file or directory
```

## A Container and No Server

I wanted the cheapest thing that could run this in production and also run locally, and that is a container. DuckDB is embedded, so there is no database server to look after. Production is a program that starts, runs `dbt build` and stops. In the repo root add a Dockerfile:

```dockerfile
FROM python:3.12-slim
RUN pip install --no-cache-dir uv
WORKDIR /app
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-install-project
COPY beer_sales ./beer_sales
WORKDIR /app/beer_sales
ENV DBT_PROFILES_DIR=/app/beer_sales
CMD ["uv", "run", "--frozen", "dbt", "build"]
```

Build it and run it with the local data mounted in:

```bash
docker build -t beer-sales .
docker run --rm -v "$(pwd)/data:/app/data" beer-sales
```

```txt
Done. PASS=10 WARN=0 ERROR=0 SKIP=0 NO-OP=0 REUSED=0 TOTAL=10
```

That is the production job running on a laptop. Take Dutty off the beer list, as we did in part 2, and the same container hands back this:

```txt
Done. PASS=9 WARN=0 ERROR=1 SKIP=0 NO-OP=0 REUSED=0 TOTAL=10
$ echo $?
1
```

The exit code of `1` is what sends an email later on. The other thing to read is `SKIP=0`. The export ran even though a test on the mart failed, because that test depends on the seed as well as the mart and dbt did not hold the export back for it. A rogue beer fails the job and its numbers still reach the summary file.

## A Throwaway AWS

[AWS Emulator](https://github.com/aws/aws-emulator) is one program from AWS that answers the AWS APIs on a local port, and it [came out on 11 November](https://aws.amazon.com/blogs/aws/test-your-applications-against-aws-locally-with-aws-emulator/). I used it for the [software factory template](https://github.com/hungovercoders/template-aws-api) and wanted everything here deployed to it as well.

My own machine turned out not to have it installed:

```txt
zsh: command not found: aws-emulator
```

From here on I wrapped the commands in sh files and ran those, and each one is shown in full where it is used. The first installs and starts the emulator, in a terminal of its own:

```bash
scripts/emulator.sh start
```

It uses an `aws-emulator` already on your PATH. Without one, on Linux and WSL it downloads a pinned version and checks AWS's signature on it, and anywhere else it runs the emulator in Docker. dbt then needs a second target in `profiles.yml`:

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
        ca_cert_file: "{{ env_var('AWS_CA_BUNDLE', '') }}"
      secrets:
        - type: s3
          provider: credential_chain
          region: "{{ env_var('AWS_REGION', 'us-east-1') }}"
          endpoint: "{{ env_var('EMULATOR_HOST', '127.0.0.1:9297') }}"
          url_style: path
          use_ssl: true
```

`httpfs` reads and writes `s3://` paths, and `credential_chain` finds credentials the way the AWS CLI does, so there are no keys in the file. One command applies the Terraform to the emulator, uploads the events and runs the build against it:

```bash
scripts/emulator.sh up
```

<details>
<summary>What <code>scripts/emulator.sh up</code> runs</summary>

```bash
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
```

</details>

```txt
Apply complete! Resources: 19 added, 0 changed, 0 destroyed.
Done. PASS=10 WARN=0 ERROR=0 SKIP=0 NO-OP=0 REUSED=0 TOTAL=10
```

That is nineteen resources and a green build against a bucket, with the SQL from part 2 untouched. The container runs against the emulator as well, given its certificate and credentials:

```bash
docker run --rm --network host \
  -e DBT_TARGET=emulator -e AWS_REGION \
  -e AWS_CA_BUNDLE=/emulator/ca.pem \
  -e AWS_SHARED_CREDENTIALS_FILE=/emulator/emulator_credentials \
  -e EVENTS_LOCATION -e SUMMARY_LOCATION \
  -v "$HOME/.aws/emulator/9297:/emulator:ro" beer-sales
```

```txt
Done. PASS=10 WARN=0 ERROR=0 SKIP=0 NO-OP=0 REUSED=0 TOTAL=10
```

### What the Emulator Would Not Do

Two things in the Terraform had to give. A plain `aws_s3_bucket` never finished creating, so the bucket is an `awscc_s3_bucket`, which works on both:

```txt
aws_s3_bucket.data: Still creating... [01m30s elapsed]
```

And on emulator 1.0.365 the security group's outbound rule failed. On 1.0.545 it applies:

```txt
Error: updating Security Group egress rules: operation error EC2:
AuthorizeSecurityGroupEgress, api error InvalidPermission.Duplicate:
the specified rule "peer: 0.0.0.0/0, ALL, ALLOW" already exists
```

I also wanted the job itself to run there, and Claude Code tried three ways in from its sandbox:

```txt
$ docker push 127.0.0.1:9297/beer-sales:latest
error from registry: the operation is unsupported

$ aws ecs run-task ...   # image python:3.12-slim, command cat /etc/os-release
cat: /etc/os-release: No such file or directory

$ aws lambda invoke ...  # a python3.12 function returning sys.version and os.getcwd()
3.12.0 [RustPython 0.6.0 with rustc 1.99.1]
OSError(38, 'a Lambda function in this emulator has no host filesystem to reach')
```

The emulator answers the AWS APIs. It does not run what is inside an image, and its [README](https://github.com/aws/aws-emulator) says not to test security on it. So Docker brings the compute and the emulator brings the S3.

## The Real Thing

A third target, and it is the emulator one with the emulator taken out:

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

On my laptop `credential_chain` finds my login and inside Fargate it finds the task's role. `infra/main.tf` is the same file the emulator took, and it makes:

- An S3 bucket, with raw events in and the summary out
- An ECR repository for the image
- An ECS cluster and a Fargate task definition
- A task role whose policy grants reading the events and writing the summary, with no delete and no other bucket named
- A log group for the `dbt build` output
- A schedule that starts the task at 06:00 UTC every day
- An SNS topic and a rule for failures

A second sh file wraps the real account. `deploy` applies the Terraform, pushes the image and uploads the events, and `run` starts the task, waits for it and prints its log:

```bash
export ALERT_EMAIL=me@example.com
scripts/aws.sh deploy
scripts/aws.sh run
```

<details>
<summary>What <code>scripts/aws.sh deploy</code> runs</summary>

```bash
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
  rm -rf data/raw/events
  uv run python scripts/generate_fake_events.py
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
```

</details>

<details>
<summary>What <code>scripts/aws.sh run</code> runs</summary>

```bash
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
```

</details>

My first go got this far:

```txt
mise ERROR No version is set for shim: terraform
```

The repo now pins Terraform in `mise.toml`. With that in place the first run against a real account passed. This capture is the second:

![The dbt build log from the Fargate task, with ten of ten steps passing against the s3 target, followed by daily_event_summary.parquet listed in the bucket's summary folder and the task stopping with exit code 0](/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/fargate_run.png)

It passed ten of ten with `target='s3'`. The image pulled, the role was allowed what it needed and the summary landed in the bucket. The first capture I took had my real account number sitting in the bucket name, so the script now swaps it for `123456789012` on the way out. The console capture further down had the same swap made by hand.

Every run in this post was started by hand. The schedule is the one piece it does not show firing.

### One Page for the Lot

I wanted to see everything as one environment in AWS, so every resource that can carry tags gets `project` and `environment` tags, and a resource group gathers them:

![The beer-sales-production resource group in the AWS console listing nine resources across ECS, ECR, EC2, Events, Logs, Resource Groups, S3 and SNS in eu-west-2, with the group's tags managed-by terraform, project beer-sales and environment production](/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/resource_group.png)

Terraform counted nineteen on the emulator, and twenty on the real account with the email subscription, because it includes policies and attachments. The group lists nine, and the three IAM roles and the schedule are not among them.

### Told When it Fails

A rule watches for the task stopping with anything other than a zero, or failing to start, and publishes to the SNS topic. To prove it, ship an image with Dutty missing:

```bash
scripts/aws.sh break
```

<details>
<summary>What <code>scripts/aws.sh break</code> runs</summary>

```bash
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
```

</details>

![The dbt build log from a Fargate task where the seed loads seven beers instead of eight, the relationships test on the mart fails with 2572 results, the export model still runs, and the task stops with exit code 1](/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/fargate_fail.png)

A minute later this was in my inbox:

> "The beer-sales dbt job failed. Stop code: EssentialContainerExited. Reason: Essential container in task exited. Task: arn:aws:ecs:eu-west-2:123456789012:task/beer-sales/0123456789abcdef0123456789abcdef. Logs are in the /ecs/beer-sales log group."

The summary file in that capture is timed 18:43:35, the second the failing run finished. That is the `SKIP=0` from earlier, on a real account.

## One Query in Three Places

I wanted one picture of all three environments answering the same query. `scripts/three_environments.sh` asks the summary file which beers are paying the bills, on the laptop, in the emulator's bucket and in the real one, then compares the answers:

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

![The output of scripts/three_environments.sh: the beer revenue query run against the summary file on the laptop, in the AWS Emulator bucket and in the real S3 bucket in eu-west-2, each returning the same eight rows with Clwb Tropica top at 887 purchases and 33624.22 revenue, ending with the line Same answer in all 3 environments](/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/three_environments.png)

All three return eight beers with the same purchases and the same revenue to the penny, with hsql from part 1 doing the asking.

## Who Did What

I didn't type this. Claude Code wrote the Terraform, the Dockerfile and the scripts in a cloud session with me steering, and its sandbox is where the emulator got taken apart. The real account was mine. The deploy, the runs and the captures came from my own terminal.

## Would I Use It

It's a bit messy still, but the emulator is great for getting more production like testing done locally. It's a shame I can't register a container in its registry and do everything in an emulated environment, and no other service fitted either.

If I did it again I'd use a script runner like Taskfile, as I usually do, in place of the sh files. I'd also have a GitHub Action for CI that runs against the emulator and then deploys. That's my next post in this series.

Three environments from one dbt setup took three targets in `profiles.yml` and three variables to choose between them: `DBT_TARGET`, `EVENTS_LOCATION` and `SUMMARY_LOCATION`.

[Fargate bills](https://aws.amazon.com/fargate/pricing/) while a task runs and not while it doesn't, and there is no server to patch. Against that, the image downloads duckdb's extensions each time it starts, the duckdb file is gone after every run, and it is one job.

I wanted to know why this wasn't Airflow. The container is the thing that runs and Airflow decides when things run, so Airflow would still be launching this image. With one job on one schedule, and dbt ordering the work inside `dbt build`, there is nothing left to orchestrate. That changes when several jobs depend on each other.

The post after that one automates the whole process from an ODCS data contract with skills.

## Sources and Further Reading

- The code, at [github.com/hungovercoders/learn.harlequin](https://github.com/hungovercoders/learn.harlequin)
- [Part 1](/blog/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin) and [part 2](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt) of this series
- The AWS Emulator [launch post](https://aws.amazon.com/blogs/aws/test-your-applications-against-aws-locally-with-aws-emulator/), its [repo](https://github.com/aws/aws-emulator) and its [user guide](https://docs.aws.amazon.com/emulator/latest/userguide/what-is-service.html)
- [dbt-duckdb](https://github.com/duckdb/dbt-duckdb), for the external materialisation and the S3 secrets
- [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/)

Well done fellow hungovercoder, crack open a can.
