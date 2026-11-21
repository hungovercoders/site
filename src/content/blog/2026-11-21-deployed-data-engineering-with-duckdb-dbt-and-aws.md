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

## Pre-Requisites

- [Part 2](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt) completed, with a green `dbt build`
- [uv](https://docs.astral.sh/uv/), Docker, Terraform and the AWS CLI
- [AWS Emulator](https://github.com/aws/aws-emulator), which the repo's script installs for you
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

In part 2 our marts became tables inside `beers.duckdb`. A deployed job is gone the moment it finishes and the duckdb file goes with it, so the results need writing somewhere that outlives the job. dbt-duckdb has an [external materialisation](https://github.com/duckdb/dbt-duckdb) for this. Add `models/exports/daily_event_summary_export.sql`:

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

`SUMMARY_LOCATION` is the same trick as `EVENTS_LOCATION`, pointing the other way. The default sits in `data/` because DuckDB writes the file but won't create a missing folder for it:

```txt
IO Error: Cannot open file "../data/exports/daily_event_summary.parquet": No such file or directory
```

## A Container and No Server

I asked for the cheapest thing that could run this in production and also run locally, and the answer was a container. DuckDB is embedded, so there is no database server to look after. Production is a program that starts, runs `dbt build` and stops. In the repo root add a Dockerfile:

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

[AWS Emulator](https://github.com/aws/aws-emulator) is one program from AWS that answers the AWS APIs on a local port, and it [came out on 11 November](https://aws.amazon.com/blogs/aws/test-your-applications-against-aws-locally-with-aws-emulator/). I used it for the [software factory template](https://github.com/hungovercoders/template-aws-api) and asked for everything here to be deployed to it as well.

My own machine turned out not to have it installed:

```txt
zsh: command not found: aws-emulator
```

So the repo has a script for it. In a terminal of its own:

```bash
scripts/emulator.sh start
```

On Linux and WSL that downloads a pinned version and checks AWS's signature on it. Anywhere else it runs the emulator in Docker. dbt then needs a second target in `profiles.yml`:

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

```txt
Apply complete! Resources: 19 added, 0 changed, 0 destroyed.
Done. PASS=10 WARN=0 ERROR=0 SKIP=0 NO-OP=0 REUSED=0 TOTAL=10
```

Nineteen resources and a green build against a bucket, with the SQL from part 2 untouched.

### What the Emulator Would Not Do

Two things in the Terraform had to give. A plain `aws_s3_bucket` never finished creating, so the bucket is an `awscc_s3_bucket`, which works on both:

```txt
aws_s3_bucket.data: Still creating... [01m30s elapsed]
```

And on emulator 1.0.365 the security group's outbound rule failed with `InvalidPermission.Duplicate`. On 1.0.545 it applies.

I also asked for the job itself to run there, and Claude Code tried three ways in from its sandbox:

```txt
docker push to the emulator's ECR
  error from registry: the operation is unsupported

an ECS task from python:3.12-slim running cat /etc/os-release
  cat: /etc/os-release: No such file or directory

a Python Lambda reporting its own runtime
  RustPython 0.6.0
  a Lambda function in this emulator has no host filesystem to reach
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

One script drives it:

```bash
export ALERT_EMAIL=me@example.com
scripts/aws.sh deploy
scripts/aws.sh run
```

My first go got this far:

```txt
mise ERROR No version is set for shim: terraform
```

The repo now pins Terraform in `mise.toml`. With that in place the first run against a real account passed. This capture is the second, taken once the script had learned to hide my account number:

![The dbt build log from the Fargate task, with ten of ten steps passing against the s3 target, followed by daily_event_summary.parquet listed in the bucket's summary folder and the task stopping with exit code 0](/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/fargate_run.png)

Ten of ten with `target='s3'`. The image pulled, the role was allowed what it needed and the summary landed in the bucket. The first capture I took had my real account number sitting in the bucket name, so the script now swaps it for `123456789012` on the way out.

Every run in this post was started by hand. The schedule is the one piece it does not show firing.

### One Page for the Lot

I wanted to see everything as one environment in AWS, so each resource carries `project` and `environment` tags and a resource group gathers them:

![The beer-sales-production resource group in the AWS console listing nine resources across ECS, ECR, EC2, Events, Logs, Resource Groups, S3 and SNS in eu-west-2, with the group's tags managed-by terraform, project beer-sales and environment production](/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/resource_group.png)

Terraform counted nineteen on the emulator because it includes policies and attachments. The group lists nine, and the three IAM roles and the schedule are not among them.

### Told When it Fails

A rule watches for the task stopping with anything other than a zero, or failing to start, and publishes to the SNS topic. To prove it, ship an image with Dutty missing:

```bash
scripts/aws.sh break
```

![The dbt build log from a Fargate task where the seed loads seven beers instead of eight, the relationships test on the mart fails with 2572 results, the export model still runs, and the task stops with exit code 1](/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/fargate_fail.png)

Within the minute this was in my inbox:

> "The beer-sales dbt job failed. Stop code: EssentialContainerExited. Reason: Essential container in task exited. Task: arn:aws:ecs:eu-west-2:123456789012:task/beer-sales/0123456789abcdef0123456789abcdef. Logs are in the /ecs/beer-sales log group."

The summary file in that capture is stamped by the failing run. That is the `SKIP=0` from earlier, on a real account.

## One Query in Three Places

I wanted one picture of all three environments answering the same query. `scripts/three_environments.sh` asks which beers are paying the bills of the summary file on the laptop, in the emulator's bucket and in the real one, then compares the answers:

![The output of scripts/three_environments.sh: the beer revenue query run against the summary file on the laptop, in the AWS Emulator bucket and in the real S3 bucket in eu-west-2, each returning the same eight rows with Clwb Tropica top at 887 purchases and 33624.22 revenue, ending with the line Same answer in all 3 environments](/assets/2026-11-21-deployed-data-engineering-with-duckdb-dbt-and-aws/three_environments.png)

Eight beers, the same purchases and the same revenue to the penny, with hsql from part 1 doing the asking.

## Who Did What

I didn't type this. Claude Code wrote the Terraform, the Dockerfile and the scripts in a cloud session with me steering, and its sandbox is where the emulator got taken apart. The real account was mine. The deploy, the runs and the captures came from my own terminal.

## Would I Use It

<!-- dataGriff: your verdict in your own words goes here, and one line on what you'd do differently. Neither can be written for you. -->

Three environments from one dbt setup took three targets in `profiles.yml` and three environment variables. That is the easy multi environment config this post set out to prove.

The facts to weigh are these. [Fargate bills](https://aws.amazon.com/fargate/pricing/) while a task runs and not while it doesn't, and there is no server to patch. Against that, the image downloads duckdb's extensions each time it starts, the duckdb file is gone after every run, and it is one job.

I asked why this wasn't Airflow. The container is the thing that runs and Airflow decides when things run, so Airflow would still be launching this image. With one job on one schedule, and dbt ordering the work inside `dbt build`, there is nothing left to orchestrate. That changes when several jobs depend on each other.

I'll likely have to follow this up with two more posts. One automates the deploy with GitHub Actions, and the other automates the whole process from an ODCS data contract with skills.

## Sources and Further Reading

- The code, at [github.com/hungovercoders/learn.harlequin](https://github.com/hungovercoders/learn.harlequin)
- [Part 1](/blog/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin) and [part 2](/blog/2026-10-31-rigorous-local-data-engineering-with-duckdb-and-dbt) of this series
- The AWS Emulator [launch post](https://aws.amazon.com/blogs/aws/test-your-applications-against-aws-locally-with-aws-emulator/), its [repo](https://github.com/aws/aws-emulator) and its [user guide](https://docs.aws.amazon.com/emulator/latest/userguide/what-is-service.html)
- [dbt-duckdb](https://github.com/duckdb/dbt-duckdb), for the external materialisation and the S3 secrets
- [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/)

Well done fellow hungovercoder, crack open a can.
