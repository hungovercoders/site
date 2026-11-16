---
title: Adding AsyncAPI, CloudEvents and a Data Contract to the Software Factory Unit
date: 2026-11-16
author: dataGriff
description: The same skeleton now takes messages from a queue, publishes events and keeps them as data in S3, each described by a contract and proved by the same feature files on AWS Emulator
tags:
  - Software Factory
  - AsyncAPI
  - CloudEvents
  - Data Contracts
  - AWS Emulator
  - Claude Code
image:
  path: /assets/2026-11-16-asyncapi-cloudevents-data-contract-software-factory-unit/link.png
---

I wanted to prove a true full stack API on my [BDD and contract driven Lambda template](https://github.com/hungovercoders/template-aws-api), where the feature files and contracts you write are also the tests and the whole stack is proved locally on AWS Emulator. For me full stack includes messages in on a queue, events out on EventBridge and a data contract over those events in S3. They were the natural next steps after [Saturday's post](/blog/2026-11-14-repeatable-unit-of-a-software-factory/) and I was busting to try them. Read on fellow hungovercoder and bring your own business logic.

The work started at a birthday curry yesterday, where I was sneakily battling CloudEvents, and ended this evening watching The X-Files. Coincidentally it was [the one in series two about the soldiers who can't sleep](https://en.wikipedia.org/wiki/Sleepless_(The_X-Files)). One setup can now represent every interface, and that's super exciting.

This post is the guided path through what was added to [template-aws-api](https://github.com/hungovercoders/template-aws-api). The sources are at the bottom. Everything in it is still pre-publication and demos, so take it as a pattern worth nicking.

## Pre-Requisites

- [Saturday's post](/blog/2026-11-14-repeatable-unit-of-a-software-factory/), for the skeleton, the gates and why CI is red on purpose
- [mise](https://mise.jdx.dev), to install Node, Task, Terraform and uv from one file
- [Claude Code](https://claude.com/claude-code), or any agent that reads `AGENTS.md`
- Linux or WSL for the native AWS Emulator, and still no AWS account

## Where the Interfaces Sit

![A pipeline left to right, sitting on a wide band. On the left are two orange boxes, the ways in. HTTP in and out, API callers, described by specs/openapi.yaml. Messages in, other services sending to an SQS queue, described by the receive operations of specs/asyncapi.yaml. Arrows lead from them into a green band labelled your API, one skeleton, the whole stack on AWS Emulator. Inside the band a two-way arrow joins HTTP to a blue box, operations, one function per operation, and an arrow joins the queue to a blue box, consumers, one function per message. Both write to DynamoDB, your data and the outbox in one write. An arrow labelled stream leads from the table to the forwarder, which puts each event on the bus. On the right are two orange boxes, the ways out. Events out, subscribers on an EventBridge bus, described by the send operations of specs/asyncapi.yaml. Below it, joined by an arrow labelled Firehose, events as data, analysts reading S3 with DuckDB, described by specs/datacontract.yaml. Beneath everything is a band labelled one spec, holding the feature files that say what every interface does and are also its tests.](/assets/2026-11-16-asyncapi-cloudevents-data-contract-software-factory-unit/interfaces.svg)

On Saturday the template had one interface. Now it has four, and each has a contract. OpenAPI still covers HTTP. AsyncAPI covers a message coming in on a queue and an event going out on a bus. A data contract covers those events once they're sitting in S3.

The orange boxes are all you write. The queue, its retries, the outbox, the bus, the bucket and the alarms for the lot are the skeleton's, the same for every API.

So it's still BDD and contract driven. You bring feature files and contracts, and the same two skills do the rest. `/write-spec` now asks what arrives on the queue, what other services need to be told and whether the events should be kept, and writes the scenarios and the contracts with you. `/implement-api` reads them and writes a consumer per message and one line per event.

The other half of the pattern holds too. Use a deterministic tool wherever one exists, and keep the agent for what's left. For the new interfaces, commands write these before the agent writes a line.

- A typed stub for every message the API receives, from `task scaffold`.
- A typed function for every event it publishes, from `task generate`. It refuses data the contract doesn't describe.
- An example of every message and event, from `task asyncapi:examples`.
- The schema half of the data contract, from `task data:generate`.

Gates then decide when it's done, with the same answer every time.

## A Rating Arrives on a Queue

The example is still the Beer Catalogue. A taproom's app now sends ratings as messages, and the behaviour is written the same way as before.

```gherkin
@operation:receive_beer_rating
Scenario: A rating delivered twice counts once
  When the taproom sends the same rating of 5 for "Morning After" twice
  And the taproom sends a rating of 3 for "Morning After"
  Then "Morning After" comes to have 2 ratings averaging 4
```

The shape goes in `specs/asyncapi.yaml` as a `receive` operation, and every message is a CloudEvent.

```yaml
receive_beer_rating:
  action: receive
  summary: Record a rating that was submitted elsewhere
  channel:
    $ref: "#/channels/beer_ratings"
  messages:
    - $ref: "#/channels/beer_ratings/messages/beer_rating_submitted"
```

It's the same `@operation` tag as the HTTP side, so the same gate applies. An operation with no scenario fails, on either contract.

`task scaffold` then writes a typed stub for the message, and the agent's whole job is the body.

```typescript
export async function receive_beer_rating({ event }: MessageContext<BeerRatingSubmitted>): Promise<void> {
  try {
    await addRating(event.data.beer_id, event.data.score, new Date().toISOString());
  } catch (error) {
    // No later delivery will find the beer either.
    if (error instanceof BeerNotFound) throw new Rejected("there is no such beer");
    throw error;
  }
}
```

Counting a duplicate once isn't in that function. Neither is validating the message, retrying it, or putting it aside when it can never succeed. The skeleton does those for every consumer, and the scenario above is what proves it on the emulator's real queue.

## An Event Leaves with the Write

Publishing is a `send` operation in the same AsyncAPI file, and a scenario says when it happens.

```gherkin
@operation:publish_beer_created @operation:create_beer
Scenario: Adding a beer publishes that it was created
  When staff add the beer "Morning After", an ipa at 5.6% abv
  Then a "created" event is published for "Morning After"
  And the event says it is an ipa at 5.6% abv
```

In the code it's one line in the write that makes the change.

```typescript
{ item: outbox(beer_created({ beer_id: beer.id, name: beer.name, style: beer.style, abv: beer.abv }, beer.id)) },
```

That's the outbox pattern. The event is written to the table in the same transaction as the beer, so there's never an event for a write that failed or a write whose event went missing. The table's stream hands it to a forwarder, which puts it on EventBridge. The agent never calls the bus.

The gates go one level down here as well. After the scenarios run, `publish:check` fails if the contract says the API publishes an event that no scenario ever saw, and `consume:check` does the same for a message nobody delivered.

## Events Kept for the Morning After

The third contract is for data. Every published event lands in S3 through Firehose, and `specs/datacontract.yaml` describes it in the Open Data Contract Standard.

```yaml
team:
  name: catalogue
servers:
  - server: production
    type: s3
    location: s3://hungovercoders-beer-catalogue-events/events/
slaProperties:
  - property: retention
    value: 2
    unit: y
  - property: latency
    value: 15
    unit: m
```

That half is a person's. It says who owns the data, where it lives, how long it's kept and how fresh it has to be, and Terraform reads the same file for the bucket, its retention and its freshness alarm.

The other half is the schema, one object per event. Here's the rating, cut down to its score.

```yaml
schema:
  - name: beer_rated
    physicalName: com.hungovercoders.beer_catalogue.beer.rated.v1
    quality:
      - metric: rowCount
        mustBeGreaterThan: 0
    properties:
      # the CloudEvent's own attributes, then
      - name: data
        properties:
          - name: score
            classification: public
            logicalType: integer
            required: true
            logicalTypeOptions:
              minimum: 1
              maximum: 5
```

A command writes the type, the limits and whether a field is required from the AsyncAPI contract, so the two can't drift. A person adds the `classification`, which is how sensitive each field is, and any `quality` rule the data has to keep.

The data contract has no scenarios of its own. Its test runs the Data Contract CLI against the events the scenarios just published, so the event scenarios do double duty. The first version downloaded them to test them. My worry with downloading as a pattern was a copy of data that could one day be sensitive, so now it reads the bucket where it is and nothing is copied. When the agent ran version 1.2.10 of the CLI against gzipped files where they sat, it failed. So I went with uncompressed as the default and no workaround. Gzip can be switched on where it suits.

Querying is a task too, with a view per event already defined. It's the same [DuckDB and Harlequin](/blog/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/) I wrote about in September.

## One Beer Through Every Interface

Here's all of it on a laptop-sized AWS. A beer goes in over HTTP, a rating for it arrives as a message, both events come out on the bus, and the rating is read back out of S3 with SQL.

<video autoplay loop muted playsinline controls>
  <source src="/assets/2026-11-16-asyncapi-cloudevents-data-contract-software-factory-unit/in-and-out.mp4" type="video/mp4">
  <source src="/assets/2026-11-16-asyncapi-cloudevents-data-contract-software-factory-unit/in-and-out.webm" type="video/webm">
  <img src="/assets/2026-11-16-asyncapi-cloudevents-data-contract-software-factory-unit/in-and-out.gif" alt="A terminal recording against the example API on AWS Emulator. A curl request adds the beer Morning After and gets it back with no ratings. A file called rating.json holds a CloudEvent from a taproom with a score of 4 for that beer, and task queue:send puts it on the queue. A second curl request fetches the beer, which now has one rating averaging 4. task events:tail then shows two events on the bus, beer created and beer rated. Last, task data:query runs select type, beer id and score from beer_rated and returns one row, the rating, read from the events bucket in S3">
</video>

Those are real requests against the example, replayed. The `curl` commands show `$URL` and `$TOKEN` where the real values were.

## Leave Out What You Don't Need

Not every API wants a queue. The queue, the events and the data are optional components, so `task component:remove -- data` takes out the bucket, its gates, its docs and its tasks, and `task component:add -- data` brings them back from the template later. CI on the template removes all of them and restores all of them on every change, and expects no difference at all.

## CloudEvents in a Borrowed Envelope

The difficult bits were CloudEvents, ordering and gzip for the Data Contract CLI. The gzip one is above, and the other two are the same story. I asked which EventBridge had been used, the classic bus or the new one. It was the classic one, and the agent hadn't looked at the newer bus at all. Then I asked whether they were really CloudEvents if they sat in an envelope.

Partly. The event is a proper CloudEvent on the queue and in S3. On a classic bus it has to ride inside EventBridge's own envelope, so a subscriber reads it from `detail`. Order isn't promised either, and an event can arrive twice. A subscriber tells a repeat by the event's `id` and puts events in order by their `time`.

[AWS's guidance for the new bus](https://github.com/aws/agent-toolkit-for-aws/tree/main/skills/specialized-skills/serverless-skills/amazon-eventbridge-event-bus) says it carries a CloudEvent as it is and can deliver in order. So the agent tried it, and the emulator can't publish to it yet. That's [issue 84](https://github.com/hungovercoders/template-aws-api/issues/84) on the template.

A limit like that is easy to write down and forget. Every gap in the emulator that the template works around, lives with or waits for is now listed with a test, and one command runs them.

![Terminal output of task emulator:gaps on AWS Emulator 1.0.365. Fourteen gaps tested and every one reported as still needed. Six are limits such as jwt-signature and firehose-metrics, three are workarounds such as queue-url-host and s3-control, and five are blocked, all starting eventsv2, including eventsv2-put-raw-events and eventsv2-ordered-delivery. The last line reads nothing to remove, every gap is still there](/assets/2026-11-16-asyncapi-cloudevents-data-contract-software-factory-unit/gaps.png)

The five marked blocked are the new bus. When the emulator version moves, the same command runs on that pull request and reports. Once the new version is on `main`, a gap that has closed raises an issue naming what can be removed. Run against the newest emulator release, one of the fourteen had already closed.

## The Same Green Tick

![Terminal output of task ci on the example implementation branch, selected lines. The spec check passes for 6 operations, the AsyncAPI check for 5 operations, 1 received and 4 published, and the data contract check for 4 events. Terraform reports Apply complete, 64 added. Cucumber passes 67 scenarios and 571 steps. The responses, consume and publish checks pass. Schemathesis reports 396 generated and 396 passed with no issues found in 83.83 seconds, and the data test reports that the data in the events bucket keeps the data contract, tested where it is](/assets/2026-11-16-asyncapi-cloudevents-data-contract-software-factory-unit/ci.png)

On Saturday the stack was twenty-three resources and fifty-three scenarios. With every interface in it's sixty-four resources and sixty-seven scenarios, and it is still one command that builds the lot, tests it and throws it away. That run was in the agent's own sandbox, which wouldn't run the emulator at all when I wrote Saturday's post.

It isn't as quick as it was. On Saturday `task ci` took two minutes and twenty-one seconds on a GitHub runner. With a queue, a bus, a stream and a bucket to stand up, the stack alone now takes about two minutes, and the whole CI job on the last run took four minutes and fifty-nine seconds.

## The Verdict So Far

I think it's worth using, and I'm happy enough with the stack now. SQS, EventBridge, Firehose, S3 and DuckDB, with a contract on every interface, and all of it works locally. A true full stack API has events and a data contract as well as HTTP, and this now has all three from one setup. The test driven specs held their own in the new formats too. A queue, a bus and a bucket went in without a new way of working. Each one is a contract, a scenario and a command that generates the boring half.

It's still not proven. Nothing here has been deployed to a real AWS account, and the list of what only a deploy can show is longer now. A fresh agent hasn't yet built an API from the template with the new interfaces in. And subscribers on the bus get a CloudEvent in an envelope, in no promised order. The new bus might fix that once the emulator can run it, or something other than EventBridge might.

The concept is what we should all strive for, and expect from our software.

## Sources and Further Reading

These are the sources.

- [AsyncAPI](https://www.asyncapi.com/docs) for describing messages and events, and [CloudEvents](https://cloudevents.io) for the envelope every one of them uses.
- The [Open Data Contract Standard](https://bitol-io.github.io/open-data-contract-standard/) and the [Data Contract CLI](https://cli.datacontract.com) that lints and tests against it.
- The [transactional outbox pattern](https://microservices.io/patterns/data/transactional-outbox.html), and the [EventBridge user guide](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html) for the bus.
- The [AWS Emulator](https://github.com/aws/aws-emulator) repo and its [user guide](https://docs.aws.amazon.com/emulator/latest/userguide/what-is-service.html).
- [template-aws-api](https://github.com/hungovercoders/template-aws-api), and [what implementing the example adds](https://github.com/hungovercoders/template-aws-api/compare/example/spec...example/implementation).
- [Saturday's post](/blog/2026-11-14-repeatable-unit-of-a-software-factory/) on the skeleton, and [September's](/blog/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/) on DuckDB and Harlequin.

## What Next

If I were doing this again I'd explore the other options before committing to EventBridge blindly. It's cheap and lightweight, but I'd like CloudEvents and ordering to be easier. A real deploy is the obvious next step, and I still want the same skeleton for Cloudflare. Watch this space for more experimentation in between meals, and see the code at [github.com/hungovercoders/template-aws-api](https://github.com/hungovercoders/template-aws-api), or in case I renamed it drunkenly check out [datagriff github](https://github.com/dataGriff).
