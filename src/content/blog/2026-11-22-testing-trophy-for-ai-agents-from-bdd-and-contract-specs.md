---
title: A Testing Trophy for AI Agents from BDD and Contract Specs
date: 2026-11-22
author: dataGriff
description: The test shape of a spec driven Lambda template turns out to be a trophy, where feature files and contracts generate almost every test and an agent only writes what is left
tags:
  - Software Factory
  - Testing
  - TDD
  - BDD
  - Claude Code
image:
  path: /assets/2026-11-22-testing-trophy-for-ai-agents-from-bdd-and-contract-specs/link.png
---

I wanted to understand the test pyramid, because my spec driven Lambda template tests itself from its feature files and contracts and I couldn't have told you what shape of testing that was. I've been running at these concepts with little expertise, so this post is me working out the design pattern of what I've built, and why deterministic specs suit an AI agent so well. Read on fellow hungovercoder.

New here? [The first post](/blog/2026-11-14-repeatable-unit-of-a-software-factory/) built the skeleton and the gates, and [the second](/blog/2026-11-16-asyncapi-cloudevents-data-contract-software-factory-unit/) added queues, events and a data contract. This one is only about the testing. It's the guided path, and the people who named these shapes are in the sources at the bottom.

## Pre-Requisites

- [Saturday's post](/blog/2026-11-14-repeatable-unit-of-a-software-factory/) on the skeleton and the gates, if you want the detail
- Nothing to install, this one is for reading
- [template-aws-api](https://github.com/hungovercoders/template-aws-api) open in another tab if you want to see the files

## The Pyramid I Was Meant to Have

The [test pyramid](https://martinfowler.com/bliki/TestPyramid.html) says to keep lots of small fast tests at the bottom and a few big slow ones at the top. Unit tests check one function. Integration tests check parts working together. End-to-end tests drive the whole thing the way a user would.

The reason for the shape is cost. A unit test fails in milliseconds and points at the line. An end-to-end test fails after minutes and tells you something is broken somewhere. So you want most mistakes caught low down.

Contract tests sit beside the pyramid. They don't ask whether the code works. They ask whether it still matches what callers were promised.

## The Shape I Actually Have

So what is my test shape? Count one run of `task ci` on the template's Beer Catalogue example and it isn't a pyramid.

![On the right, four bands stacked into the shape of a trophy. At the bottom a wide purple base, static checks: lint, compatibility and types, and 10 Terraform plan tests. Above it a narrow blue stem, unit tests: 183 tests of the business rules and the skeleton. Above that the widest band, a green bowl, integration: 68 scenarios and 469 fuzzed requests through API Gateway to the Lambda on AWS Emulator. At the top a small dashed box, real AWS, nothing runs here yet. On the left, four boxes say where each band comes from, each joined to its band by an arrow. A real deploy points at the dashed top. Feature files and contracts point at the green bowl. Written, not derived, by the agent like the code, points at the unit stem. Contracts, SLOs and Terraform point at the purple base.](/assets/2026-11-22-testing-trophy-for-ai-agents-from-bdd-and-contract-specs/trophy.svg)

It's a [testing trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications). That's Kent C. Dodds' name for a wide base of static checks, a modest layer of unit tests and a fat middle of integration tests. Spotify made a similar case for services and called theirs a [honeycomb](https://engineering.atspotify.com/2018/01/testing-of-microservices). Both say to test through the interface, because the interface is what callers depend on.

A fat middle is normally where a test suite gets slow and flaky. Two things let this one get away with it. The whole stack runs on the mighty [AWS Emulator](https://github.com/aws/aws-emulator), so it's built for the run and thrown away after. And the skeleton is the same for every API, so its tests were written once.

The top of the trophy is empty. Nothing has ever run against a real AWS account.

## Nobody Wrote the Middle

Here's the design pattern. In most codebases a person writes each layer by hand, after the code, and the layers drift apart. Here the spec comes first and the tests fall out of it.

A scenario in a feature file is the test. Cucumber runs it as written, through the emulator's API Gateway to the built Lambda. The agent still writes the step definitions that join those words to the API, from outlines a command generates.

```gherkin
@operation:list_beers_v0
Scenario: A caller who lists the beers too fast is told to slow down
  When a caller lists the beers faster than the catalogue allows
  Then some of those calls are told to slow down
  And the rest list the beers
```

The limit that scenario hits is three lines in the OpenAPI contract.

```yaml
x-rate-limit:
  requests_per_second: 20
  burst: 40
```

Terraform reads those lines and throttles the routes. The contract also validates every request, checks every response the scenarios receive, and hands [Schemathesis](https://schemathesis.readthedocs.io) what it needs to generate 469 requests of its own.

I aim to be test driven and often end up lazy and doing it after. This fixes that by leaving me no choice. The spec is the test, so it can't be written afterwards.

The same idea was put to the test when the template needed non-functional requirements. Could retention, rate limits and service levels be testable specs like the others, without saying anything twice? Retention is in the data contract, the rate limit is in the OpenAPI contract, and the service levels are [OpenSLO](https://github.com/OpenSLO/OpenSLO) files that set the production alarms.

## Why an Agent Likes a Referee

An agent isn't deterministic. A test is the opposite, and the same code gets the same verdict every time. Ask an agent for the same thing twice and you get two different pieces of code.

Put them together and the agent's variety stops mattering. It can write the function however it likes, and the specs decide whether it's finished. AI does the typing and the specs do the marking.

Three things make that work in practice.

- A red gate is the best prompt going. It names the operation with no scenario, or the response nobody received, and it can't be argued with.
- The agent can't mark its own homework. The skeleton is locked, so it can't loosen a gate to get a green tick, and the spec is read-only unless a person asks for a change.
- Commands go first. Types, routes, stubs and example requests are generated, so the agent only writes what no command can. Use a deterministic tool until you can't.

## Two Catches from the Bottom

The bottom of the trophy earned its keep this week.

The first was in the Terraform plan tests. They plan the infrastructure against small fixture contracts with mock providers, so no account and no emulator is needed. One asserts that data kept for two years expires after 730 days.

```hcl
assert {
  condition     = one([for rule in aws_s3_bucket_lifecycle_configuration.data[0].rule : rule.expiration[0].days if rule.id == "retention-v0-parquet"]) == 730
  error_message = "v0's Parquet is kept for the contract's retention, 2 years."
}
```

The first time it ran, it failed. The contract says `unit: y` for years, and Terraform's YAML reader takes a bare `y` to mean true. The code no longer saw years, so two years of retention had become two days. No scenario would have caught that, because no scenario waits two days.

The second was in the gate that checks every operation has a scenario. It counted an `@operation` tag anywhere in a feature file, including inside a comment. A commented-out scenario was passing as coverage. It only showed up when the template gained a starter feature file made entirely of comments.

Both were found by the agent's own gates while Claude Code was building the thing, and both fixes were a few lines.

## What the Trophy Doesn't Hold

For a tech lead weighing this up, the gaps matter as much as the layers.

- Nothing runs on real AWS. The emulator doesn't verify a token's signature or enforce IAM the way AWS does ([the template's list of what it does and doesn't emulate](https://github.com/hungovercoders/template-aws-api/blob/main/docs/testing.md)), so security is unproven until there's a deploy.
- There are no consumer-driven contract tests. The template tests its own promises, and nothing records what a particular consumer relies on. Versioned contracts and the compatibility gates stand in for that today.
- The business logic has few unit tests of its own. Most of the 183 belong to the skeleton. The rules are mostly proved by the scenarios.
- It's all pre-publication and demos. Take it as a pattern worth nicking.

## Would I Tell You to Work This Way

I'd use the pattern now. The same gates took retention, rate limits and service levels without a new kind of check.

The cost is up front. Somebody has to write the feature files and the contracts before any code exists, and decide what the API promises. That part stays with a person, and the `/write-spec` skill asks for it and never invents it. The concept is what we should all strive for, and expect from our software.

## Sources and Further Reading

These are the sources.

- Martin Fowler on the [test pyramid](https://martinfowler.com/bliki/TestPyramid.html), Kent C. Dodds on the [testing trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications) and Spotify on the [testing honeycomb](https://engineering.atspotify.com/2018/01/testing-of-microservices).
- [Cucumber](https://github.com/cucumber/cucumber-js) for the scenarios, [Schemathesis](https://schemathesis.readthedocs.io) for the fuzzing and [Terraform tests](https://developer.hashicorp.com/terraform/language/tests) for the plan tests.
- [OpenSLO](https://github.com/OpenSLO/OpenSLO) for the service levels, and the [Open Data Contract Standard](https://bitol-io.github.io/open-data-contract-standard/) for retention.
- The [AWS Emulator](https://github.com/aws/aws-emulator) repo and its [user guide](https://docs.aws.amazon.com/emulator/latest/userguide/what-is-service.html).
- [template-aws-api](https://github.com/hungovercoders/template-aws-api), and the worked example in its [examples folder](https://github.com/hungovercoders/template-aws-api/tree/main/examples/beer-catalogue).

## What Next

A real deploy is what's left, because the top of the trophy is the only part with nothing in it. Watch this space for more experimentation in between meals, and see the code at [github.com/hungovercoders/template-aws-api](https://github.com/hungovercoders/template-aws-api), or in case I renamed it drunkenly check out [datagriff github](https://github.com/dataGriff).
