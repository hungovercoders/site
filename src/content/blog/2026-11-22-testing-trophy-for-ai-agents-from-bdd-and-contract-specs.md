---
title: A Testing Trophy for AI Agents from BDD and Contract Specs
date: 2026-11-22
author: dataGriff
description: The test shape of a spec driven Lambda template turns out to be a trophy, mostly integration tests, because an AI agent reads the feature files and contracts to learn what to build and the same files then run as the tests
tags:
  - Software Factory
  - Testing
  - TDD
  - BDD
  - Claude Code
image:
  path: /assets/2026-11-22-testing-trophy-for-ai-agents-from-bdd-and-contract-specs/link.png
---

I went looking for the test pyramid in my spec driven Lambda template and found a trophy instead, a suite that is mostly integration tests. An AI agent reads the feature files and contracts to learn what to build, then the same files run as the tests.

Man Utd have just been battered 4-0 by Liverpool, and instead of consoling my team's demise with a bottle of wine I've decided to research the test patterns and techniques that underpin my thinking, as I've pretty much just made stuff up so far. I think my made up specs to test framework is a winner all the same.

If you're arriving cold, [the first post](/blog/2026-11-14-repeatable-unit-of-a-software-factory/) built the skeleton and the gates, and [the second](/blog/2026-11-16-asyncapi-cloudevents-data-contract-software-factory-unit/) added queues, events and a data contract. This one is only about the testing, the design pattern underneath it and why deterministic specs suit an agent. It's the guided path, and the people who named these shapes are in the sources at the bottom.

Read on fellow hungovercoder.

## Pre-Requisites

- [Saturday's post](/blog/2026-11-14-repeatable-unit-of-a-software-factory/) on the skeleton and the gates, if you want the detail
- [template-aws-api](https://github.com/hungovercoders/template-aws-api) open in another tab if you want to see the files

## The Pyramid I Was Meant to Have

The [test pyramid](https://martinfowler.com/bliki/TestPyramid.html) says to keep lots of small fast tests at the bottom and a few big slow ones at the top.

![A pyramid of three bands on the left, with an arrow up its right side. A small band at the top, end-to-end, few. A medium band in the middle, integration, some. A wide band at the bottom, unit, many. The arrow is labelled slower and vaguer going up: at the bottom a failure takes milliseconds and names the line, at the top it takes minutes and says something broke. Beside the pyramid a separate box holds contract tests, which ask whether the code is still as promised.](/assets/2026-11-22-testing-trophy-for-ai-agents-from-bdd-and-contract-specs/pyramid.svg)

- **Unit tests** check one function.
- **Integration tests** check parts working together.
- **End-to-end tests** drive the whole thing the way a user would.
- **[Contract tests](https://martinfowler.com/bliki/ContractTest.html)** sit beside the pyramid. They ask whether the code still matches what callers were promised.

## The Shape I Actually Have

So what is my test shape? Count one run of `task ci` on the template's Beer Catalogue example and it isn't a pyramid.

![Two shapes side by side joined by an arrow labelled then I counted. On the left, under the heading what I thought I had, a pyramid of three bands. A small band at the top, end-to-end, few and slow. A medium band in the middle, integration. A wide band at the bottom, unit, many and fast. On the right, under the heading what I had, a trophy of four bands. A small dashed band at the top, real AWS, empty. A wide green band below it, integration, the most, on AWS Emulator. A narrow blue band, unit, a few. A wide purple band at the bottom, static checks.](/assets/2026-11-22-testing-trophy-for-ai-agents-from-bdd-and-contract-specs/pyramid-vs-trophy.svg)

It's a [testing trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications). That's Kent C. Dodds' name for a wide base of static checks, a modest layer of unit tests and a fat middle of integration tests. Spotify made a similar case for services and called theirs a [honeycomb](https://engineering.atspotify.com/2018/01/testing-of-microservices). Both say to test through the interface, because the interface is what callers depend on.

Here it is with the counts from that run, and where each layer comes from.

![On the right, four bands stacked into the shape of a trophy. At the bottom a wide purple base, static checks: lint, compatibility and types, and 10 Terraform plan tests. Above it a narrow blue stem, unit tests: 183 tests of the business rules and the skeleton. Above that the widest band, a green bowl, integration: 68 scenarios and 469 fuzzed requests through API Gateway to the Lambda on AWS Emulator. At the top a small dashed box, real AWS, nothing runs here yet. On the left, four boxes say where each band comes from, each joined to its band by an arrow. A real deploy points at the dashed top. Feature files and contracts point at the green bowl. Written, not derived, by the agent like the code, points at the unit stem. Contracts, SLOs and Terraform point at the purple base.](/assets/2026-11-22-testing-trophy-for-ai-agents-from-bdd-and-contract-specs/trophy.svg)

A fat middle is normally where a suite gets slow and flaky. This one runs on the mighty [AWS Emulator](https://github.com/aws/aws-emulator), built for the run and thrown away after. The top of the trophy is empty, because nothing has ever run against a real AWS account.

## The Tests Come from the Specs

This is the design pattern. In most codebases a person writes each layer by hand, after the code, and the layers drift apart. Here the spec comes first, and nobody writes the integration tests as code. Running the specs as tests is why most of the suite is integration tests.

![Five rows read left to right, each a spec you write, the tool that runs it as a test, and what that proves. Feature files, Gherkin scenarios in plain words, are run by Cucumber on AWS Emulator and prove what the API does, 68 scenarios. The OpenAPI contract is used by the router and Schemathesis to check every request and response and fuzz 469 more, proving the HTTP shape and the rate limit. The AsyncAPI contract gives schema checks on every message taken and event published, proving messages and events as CloudEvents. The data contract is tested by the Data Contract CLI against what landed in S3, proving the data kept as JSON and Parquet. The SLOs, OpenSLO files for availability and latency, are validated by oslo and planned by Terraform tests, proving the alarms and limits with 10 plan tests. All five rows sit on one band at the bottom, task ci, which gives one verdict, green or red, the same every time.](/assets/2026-11-22-testing-trophy-for-ai-agents-from-bdd-and-contract-specs/specs-as-tests.svg)

I aim to be test driven and often end up lazy and doing it after. This fixes that by leaving me no choice. The spec is the test, so it can't be written afterwards. That's [test driven development](https://martinfowler.com/bliki/TestDrivenDevelopment.html) with the order enforced.

## Five Specs Doing the Testing

Each row of that picture is an open standard with a tool behind it. None of them is mine.

- **Behaviour.** [BDD](https://cucumber.io/docs/bdd/) is behaviour driven development, where you agree what the software does in examples before building it. You write the examples in [Gherkin](https://cucumber.io/docs/gherkin/reference/), the Given, When, Then language, and [Cucumber](https://github.com/cucumber/cucumber-js) runs them.
- **HTTP.** An [OpenAPI](https://www.openapis.org/what-is-openapi) contract describes every operation, request and response. The router validates against it, and [Schemathesis](https://schemathesis.readthedocs.io) generates requests from it. That's [property-based testing](https://hypothesis.works/articles/what-is-property-based-testing/) for an API.
- **Messages and events.** [AsyncAPI](https://www.asyncapi.com/docs) does for queues and buses what OpenAPI does for HTTP. Every message is a [CloudEvent](https://cloudevents.io), the common envelope for events.
- **Data.** The [Open Data Contract Standard](https://bitol-io.github.io/open-data-contract-standard/) says what the stored events look like, how long they're kept and how sensitive each field is. The [Data Contract CLI](https://cli.datacontract.com) tests the real files against it.
- **Service levels.** An [SLO](https://sre.google/sre-book/service-level-objectives/) is a target such as 99.9% of requests answered without a server error. [OpenSLO](https://github.com/OpenSLO/OpenSLO) is the file format, and [Terraform's own tests](https://developer.hashicorp.com/terraform/language/tests) prove the alarms are built from it.

Here's one requirement going through two of them. Drinkers rate a beer, and a scenario says how the average is worked out. The catalogue already holds "Morning After" when it starts.

```gherkin
@operation:rate_beer_v0
Scenario: The average covers every rating, to one decimal place
  Given "Morning After" has been rated 5, 4 and 4
  When a drinker rates "Morning After" 2
  Then the rating is recorded
  And the beer has 4 ratings averaging 3.8
```

The OpenAPI contract says what a score can be.

```yaml
score:
  type: integer
  minimum: 1
  maximum: 5
```

The two split the work. The contract carries the shape, so the router refuses a score of 6 or 3.5 without a line of code. The scenario carries the business rule, and somebody still has to write the sum. Cucumber runs the scenario as written, through the emulator's API Gateway to the built Lambda. The agent writes the step definitions that join those words to the API, from outlines a command generates.

The same contract sets the rate limit too. Terraform reads it to throttle the routes, and a scenario calls too fast to prove it.

## The Brief Is Also the Test

Each spec is used twice, once as the agent's instructions and once as its test.

First the agent reads the feature files and contracts to learn what to build. They are its brief, written in plain words and standard formats it already knows. Context is hard to manage and I only want what's necessary in it, so a file that is both the instructions and the test earns its place.

Then the gates run those same files as the tests. Nobody rewrites a requirement into a separate test, so what the agent was told and what it is judged on can't disagree.

![On the left one orange box, the specs: feature files and contracts, written once. Two arrows leave it. The upper arrow, labelled read as the brief, goes to a blue box, the agent, which reads them as its context. An arrow from the agent, labelled writes, goes to a box on the right, the code: operations, steps and rules. The lower arrow from the specs, labelled run as the tests, goes to a green box, the gates, task ci, one verdict. An arrow from the code down to the gates is labelled judged. A dashed red arrow goes from the gates back up to the agent, labelled red, names what is missing. A green arrow leaves the gates to the right, to a box labelled done.](/assets/2026-11-22-testing-trophy-for-ai-agents-from-bdd-and-contract-specs/brief-and-test.svg)

Two AI agents given the same brief will write different code. That only matters if nothing checks the result. The tests are deterministic, so the same specs give the same verdict every time. However the agent writes the code, any code that passes does what the specs say.

## Why an Agent Likes a Referee

The agent can write the function however it likes, and the specs decide whether it's finished. AI does the typing and the specs do the marking.

Here's a gate doing the marking. Take the `@operation:retire_beer_v0` tag off the scenarios that cover retiring a beer, and the first spec gate stops and names what's missing.

![Terminal output of task spec:check on the Beer Catalogue example. It reports spec:check failed, with one line underneath, operation retire_beer_v0 has no scenario tagged @operation:retire_beer_v0, and the task exits with status 1](/assets/2026-11-22-testing-trophy-for-ai-agents-from-bdd-and-contract-specs/red-gate.png)

Three things make the marking work.

- A red gate is the best prompt going. It names the operation with no scenario, or the response nobody received, and it can't be argued with.
- The agent can't mark its own homework. The skeleton is locked, so it can't loosen a gate to get a green tick, and the spec is read-only unless a person asks for a change.
- Commands go first. They generate the types, routes, stubs and example requests, so the agent only writes what no command can. Use a deterministic tool until you can't.

## Two Catches from the Bottom

The static checks at the bottom of the trophy caught two bugs this week. Each one came from a different spec.

### A Data Contract and a Plan Test

The spec is the data contract. It says how long the events are kept, in three lines.

```yaml
slaProperties:
  - property: retention
    value: 2
    unit: y
```

The test is a [Terraform plan test](https://developer.hashicorp.com/terraform/language/tests). It plans the infrastructure from a small fixture contract with mock providers, so it needs no account and no emulator. It asserts that two years means the bucket deletes after 730 days.

```hcl
assert {
  condition     = one([for rule in aws_s3_bucket_lifecycle_configuration.data[0].rule : rule.expiration[0].days if rule.id == "retention-v0-parquet"]) == 730
  error_message = "v0's Parquet is kept for the contract's retention, 2 years."
}
```

The first time it ran, it failed. Put the old line of Terraform back and it fails the same way, with 2 where 730 should be.

![Terminal output of terraform test on the data plan test with the old line restored. The run each_copy_is_kept_for_its_own_retention fails with Test assertion failed. The diff shows actual 2 and expected 730, under the message v0's Parquet is kept for the contract's retention, 2 years. The last line reads Failure, 0 passed, 1 failed](/assets/2026-11-22-testing-trophy-for-ai-agents-from-bdd-and-contract-specs/plan-test-fail.png)

Terraform's YAML reader takes a bare `y` to mean true. The code no longer saw years, so two years of retention had become two days. No scenario would have caught that, because no scenario waits two days.

### A Feature File and a Coverage Check

The specs here are the feature files and the OpenAPI contract together. The test is `spec:check`, the gate from earlier that fails when an operation in the contract has no scenario tagged for it.

It counted an `@operation` tag anywhere in a feature file, including in a comment. Lines like these, from the starter feature file that comes with the template, would have passed as coverage.

```gherkin
#   @operation:create_thing_v0
#   Scenario: A member of staff adds a thing
```

Only real tag lines count now, and a unit test holds the gate to that.

The template's own gates found both while Claude Code was building it, and each fix was a few lines.

## What Isn't Tested Yet

Three things are missing, and you should know them before copying any of this.

- **Real AWS.** The scenarios and the fuzzing run on the emulator, which doesn't verify a token's signature or enforce IAM the way AWS does. The template [lists what the emulator does and doesn't cover](https://github.com/hungovercoders/template-aws-api/blob/main/docs/testing.md). Security stays unproven until there's a deploy.
- **What a consumer relies on.** The template tests its own promises. Nothing records which fields a particular caller depends on. Consumer-driven contract tests do that, and versioned contracts and the compatibility gates stand in for them today.
- **Speed under load.** The gates check the service levels as files, and a plan test proves the alarms are built from them. Nothing measures how fast the API answers, so real traffic is the first test of a latency target.

## Looking Back at the Pattern

I'd use the pattern now. What seems weird to me is that spec driven development never used the specs we already had, considering they're testable too. OpenAPI, AsyncAPI, Gherkin and data contracts were all there to be picked up. The same gates took retention, rate limits and service levels without a new kind of check.

AI had me exploring testing patterns quickly, and it really helped my learning. I'd made this up as I went, and it turned out the shapes already had names.

The cost is up front. Somebody has to write the feature files and the contracts before any code exists, and decide what the API promises. That part stays with a person, and the `/write-spec` skill asks for it and never invents it.

It's all still pre-publication and demos, so take it as a pattern worth nicking. A real deploy is what's left, because the top of the trophy is the only part with nothing in it. The concept is what we should all strive for, and expect from our software.

Watch this space for more experimentation in between meals, and see the code at [github.com/hungovercoders/template-aws-api](https://github.com/hungovercoders/template-aws-api), or in case I renamed it drunkenly check out [hungovercoders github](https://github.com/hungovercoders).

## Sources and Further Reading

These are the sources.

- Martin Fowler on the [test pyramid](https://martinfowler.com/bliki/TestPyramid.html), Kent C. Dodds on the [testing trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications) and Spotify on the [testing honeycomb](https://engineering.atspotify.com/2018/01/testing-of-microservices).
- Cucumber's guides to [BDD](https://cucumber.io/docs/bdd/) and [Gherkin](https://cucumber.io/docs/gherkin/reference/), and Martin Fowler on [contract tests](https://martinfowler.com/bliki/ContractTest.html) and [test driven development](https://martinfowler.com/bliki/TestDrivenDevelopment.html).
- The standards behind the specs: [OpenAPI](https://www.openapis.org/what-is-openapi), [AsyncAPI](https://www.asyncapi.com/docs), [CloudEvents](https://cloudevents.io), the [Open Data Contract Standard](https://bitol-io.github.io/open-data-contract-standard/) and [OpenSLO](https://github.com/OpenSLO/OpenSLO).
- The tools that run them: [Cucumber](https://github.com/cucumber/cucumber-js), [Schemathesis](https://schemathesis.readthedocs.io), the [Data Contract CLI](https://cli.datacontract.com) and [Terraform tests](https://developer.hashicorp.com/terraform/language/tests).
- The [AWS Emulator](https://github.com/aws/aws-emulator) repo and its [user guide](https://docs.aws.amazon.com/emulator/latest/userguide/what-is-service.html).
- [template-aws-api](https://github.com/hungovercoders/template-aws-api), and the worked example in its [examples folder](https://github.com/hungovercoders/template-aws-api/tree/main/examples/beer-catalogue).
