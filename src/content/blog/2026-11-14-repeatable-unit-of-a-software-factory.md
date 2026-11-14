---
title: The Repeatable Unit of a Software Factory with BDD, Contracts and AWS Emulator
date: 2026-11-14
author: dataGriff
description: A skeleton solved once, a spec made of feature files and an OpenAPI contract, and deterministic gates on the new AWS Emulator that tell the agent when it is done
tags:
  - Software Factory
  - BDD
  - OpenAPI
  - AWS Emulator
  - Terraform
  - Claude Code
image:
  path: /assets/2026-11-14-repeatable-unit-of-a-software-factory/link.png
---

I wanted to solve what I can once, so AI doesn't solve it again from scratch. Making an API from first principles every time is a burden, and an agent will cheerfully carry it for you, a little differently on every repo. [Last week](/blog/2026-11-07-slopstopper-steward-course-and-friends/) I wrote about the gates on my software factory. This week is the thing that goes down the line. It's a template for AWS Lambda APIs where the skeleton is already built, the spec is two files, and the new AWS Emulator lets the whole lot prove itself before it gets anywhere near an account. Read on fellow hungovercoder and bring your own business logic.

This post is the guided path through [template-aws-api](https://github.com/hungovercoders/template-aws-api). The sources are at the bottom. Everything in it is pre-publication and demos at the moment, so take it as a pattern worth nicking and not a product.

## Pre-Requisites

- [mise](https://mise.jdx.dev), to install Node, Task, Terraform and uv from one file
- [Claude Code](https://claude.com/claude-code), or any agent that reads `AGENTS.md`
- Linux or WSL for the native AWS Emulator (there's a Docker route for a Mac in the template, untested)
- No AWS account, and that's rather the point

## Where the Unit Sits

![Three boxes left to right, then a band beneath. Solved once: the skeleton, the same for every API, holding the router and request validation, the test harness, the Terraform, the CI pipeline and the gates themselves. You bring: the spec, two files that check each other, feature files saying what the API does and an OpenAPI contract saying what it looks like. The agent fills in: only what no command can derive, the body of each step and each operation, after task scaffold has generated the types, the route table and a typed stub for every operation and sentence. Beneath all three, a green band of deterministic gates run by one command, task ci, the same on a laptop and in CI: lint the contract, version the change, run every scenario against the built Lambda on AWS Emulator, then fuzz it. A dashed red arrow loops from the gates back to the agent saying exactly what is missing, and a green arrow leaves the gates when it ships](/assets/2026-11-14-repeatable-unit-of-a-software-factory/unit.svg)

Start on the left of that picture. The skeleton is everything every API needs and nobody should write twice. That's the routing, the request validation, the error bodies, the test harness, the Terraform and the pipeline. The spec is the only part that makes your API yours. The agent fills in what's left, and the gates tell it when it has finished. Same input, same verdict, exactly as last week.

The skeleton is the same for all your APIs, so don't ask AI to build it again. A lock file records every skeleton file and the first gate fails if one changes, so an agent can't quietly rewrite the router to get a green tick.

## Two Specs Marking Each Other's Homework

I aim to be test driven and often end up lazy and doing it after. Specs that drive both the implementation and the tests fix that by leaving me no choice, because they have to be written up front.

The first half of the spec is behaviour, in words a product owner could read.

```gherkin
@operation:create_beer
Scenario: Two beers cannot share a name
  Given the catalogue has the beer "Morning After", an ipa at 5.6% abv
  When staff add the beer "Morning After", a stout at 7.0% abv
  Then the request is refused because the name is taken
```

The second half is the shape, as an OpenAPI contract.

```yaml
post:
  operationId: create_beer
  summary: Add a beer to the catalogue
  requestBody:
    required: true
    content:
      application/json:
        schema:
          $ref: "#/components/schemas/NewBeer"
```

That `@operation:create_beer` tag is the join. A gate fails if an operation has no scenario, or a scenario names an operation that isn't in the contract, so neither file can wander off on its own.

The contract earns its keep four times over. The router validates every incoming request against it, so nobody hand-writes a 400. Terraform reads it to create one API Gateway route per operation. Every response in every scenario is checked against it for status, content type and body. Then Schemathesis generates requests from it, valid and daft alike, and checks the answers. The same two files are the instructions for building the API and the tests that prove it got built.

## Let the Commands Go First

This is the principle underneath all of it. Lean on a deterministic process wherever one exists, and keep the agent for work that's new, or for following an explicit process written down in a skill.

So before an agent writes a line, commands do everything that can be worked out from the spec.

- `task generate` writes the TypeScript types, the runtime contract and the route table.
- `task scaffold` writes a typed file for every operation and a pending step for every sentence in the feature files.
- `task http:generate` writes a ready-to-send `.http` request for every operation.
- `task readme:generate` rewrites the README to describe your API, because once it has a spec it's no longer a template.

![The README of the example API as task readme:generate wrote it from the contract. A Beer Catalogue API title, a one paragraph description, version 2.0.0 with links to the contract, the behaviour and the requests to try, then a table of the six operations with the request, who can call it and what it does](/assets/2026-11-14-repeatable-unit-of-a-software-factory/readme.png)

On the example that's six operation files and seventy-three pending steps before any judgement is needed. Here it is on the branch that has a spec and nothing else.

<video autoplay loop muted playsinline>
  <source src="/assets/2026-11-14-repeatable-unit-of-a-software-factory/backlog.mp4" type="video/mp4">
  <source src="/assets/2026-11-14-repeatable-unit-of-a-software-factory/backlog.webm" type="video/webm">
  <img src="/assets/2026-11-14-repeatable-unit-of-a-software-factory/backlog.gif" alt="A terminal recording on the example spec branch. task test:unit fails and lists six operations with no file. task scaffold then writes 6 operation stubs and adds 73 pending steps. task test:unit runs again and still fails, now listing the six operations left to implement">
</video>

The gate stays red, and what it says is now the to-do list. Each operation arrives looking like this.

```typescript
export async function create_beer(context: Context<"create_beer">): Promise<Result> {
  throw new HttpProblem(501, "Not Implemented", "create_beer is not implemented yet.");
}
```

The agent's whole job is the body. Two skills hold the process. `/write-spec` works through the requirements with a person and won't invent them, and `/implement-api` fills in the stubs and works gate by gate until `task ci` is green.

## A Throwaway AWS on the Runner

In the past I'd have needed LocalStack for this bit. Then the [AWS Emulator](https://github.com/aws/aws-emulator) came out last Wednesday, 11 November, and made it all a good deal easier. It's one program from AWS that answers the AWS APIs on a local HTTPS port. No account, no fee, and it forgets everything when it stops.

The template downloads a pinned version and checks AWS's signature on it. It unpacks into the repo, so nothing is installed system-wide. Then it applies the project's real Terraform to the emulator.

<video autoplay loop muted playsinline>
  <source src="/assets/2026-11-14-repeatable-unit-of-a-software-factory/green-run.mp4" type="video/mp4">
  <source src="/assets/2026-11-14-repeatable-unit-of-a-software-factory/green-run.webm" type="video/webm">
  <img src="/assets/2026-11-14-repeatable-unit-of-a-software-factory/green-run.gif" alt="A terminal recording of the end of task ci, taken from the GitHub Actions log of the example implementation branch. Terraform creates the Lambda function, the alarms and one API Gateway route per operation on the AWS Emulator and reports Apply complete, 23 added. Cucumber then passes 50 scenarios and 278 steps, and Schemathesis reports 411 generated test cases, 411 passed, no issues found">
</video>

That's the tail of a real run, lifted from the GitHub Actions log. Twenty-three resources, fifty scenarios, then four hundred and eleven fuzzed requests.

I was super excited when I saw Terraform deploy to it. There's no second definition of the table for the tests to drift away from.

Here's the bit the launch posts don't lead with. The emulator will take your Lambda and your API Gateway definitions, but it can't invoke a function yet. Its own issue list says so. The feature and fuzz runs therefore call the built bundle, the very file that gets deployed, through a small stand-in that makes the same event API Gateway would. DynamoDB is the emulator's. It's a real limit, and the template's testing guide has a table of which layers match production and which don't.

It also sends anonymous usage stats to AWS by default. Set `EMULATOR_TELEMETRY=off` if you'd rather it kept quiet.

The whole run takes about a minute on a GitHub runner, and it's the same `task ci` on a laptop. Isolated and portable is what gives me confidence in a pull request to main before anything touches production.

## Red on Purpose

The repo has three branches and two of them fail CI deliberately.

- `main` is the template. It's red because there's no spec yet.
- `example/spec` adds a spec for a beer catalogue. It's red because nothing's implemented, and the failure lists the six operations still to write.
- `example/implementation` is the same spec delivered, and it's green.

A template with a red build looks broken. It's the gate doing its job, and the diff between the branches shows you what a spec looks like and what implementing one adds.

## The Agent in Shot

I didn't type this. Claude Code built it in one session with me steering, and its own sandbox wouldn't run the emulator, so every feature run and every fuzz run happened on GitHub Actions and it had to wait for the tick like the rest of us.

A skill written by an agent and tested by the same agent proves very little. So a fresh one that had never seen the answer was pointed at the spec and told to follow the skill and nothing else. CI went green on its first push. A second fresh agent did the same after the skill had changed.

Then a harder test. One agent changed the spec of the finished API from a written brief, a second caught the code up, and that was green first time too. It also found a hole. One requirement changed a rule without changing the contract's shape (an average rating would only show after three ratings) and the compatibility gate saw nothing at all. A change every consumer would notice went out as a minor version. The gate now reads the feature files as well and lists every existing scenario that changed.

![Terminal output of task spec:compat on the changed spec, going from 2.0.0 to 2.1.0. No breaking contract changes, but under Existing behaviour changed it lists three changed scenarios and one removed, The first rating sets the average, and says that if a consumer can observe this it needs a new major version and that is a person's decision](/assets/2026-11-14-repeatable-unit-of-a-software-factory/compat.png)

That one's the agent's lesson, found by a test and not by a consumer.

## Would I Build on It

I'd use the pattern now. Human-readable specs that are also the tests are a big part of why, and so is knowing a pull request has been through the lot before I read it.

This particular template isn't proven yet. It has never been deployed to a real AWS account. The alarms and the JWT authoriser have only ever been applied to the emulator, the deploy role has only been validated, and the emulator can't tell you whether API Gateway, IAM and the Lambda runtime behave. Only a deploy can. The emulator is days old as well, so the version is pinned.

It fits how I like to work all the same. It's small, it's yours, it's in source control, and the checking happens at the keyboard and on the pull request and not three weeks downstream.

## Sources and Further Reading

This post is the guided path. These are the sources.

- The [AWS Emulator repo](https://github.com/aws/aws-emulator) and its [user guide](https://docs.aws.amazon.com/emulator/latest/userguide/what-is-service.html), for what it emulates and how to point an SDK at it.
- [template-aws-api](https://github.com/hungovercoders/template-aws-api), and the two diffs worth reading, [what a spec looks like](https://github.com/hungovercoders/template-aws-api/compare/main...example/spec) and [what implementing one adds](https://github.com/hungovercoders/template-aws-api/compare/example/spec...example/implementation).
- [Cucumber](https://github.com/cucumber/cucumber-js) for the feature files, [Spectral](https://github.com/stoplightio/spectral) for linting the contract, [Schemathesis](https://schemathesis.readthedocs.io) for the fuzzing and [oasdiff](https://github.com/oasdiff/oasdiff) for spotting breaking changes.
- [Last week's post](/blog/2026-11-07-slopstopper-steward-course-and-friends/) on the gates, and the [2024 one](/blog/2024-12-22-create-a-cracker-of-an-open-api-contract-with-vs-code-spectral-prism-and-schemathesis/) where the contract tooling started.

## What Next

For once there's nothing I'd do differently. The template's gone well and I'm looking forward to adding more to it. Next up is AsyncAPI, with a message coming in on a queue, an event going out on EventBridge from an outbox and a data contract to S3 as patterns. After that I want the same skeleton for Cloudflare and other assets. Watch this space for more experimentation in between meals, and see the code at [github.com/hungovercoders/template-aws-api](https://github.com/hungovercoders/template-aws-api), or in case I renamed it drunkenly check out [datagriff github](https://github.com/dataGriff).
