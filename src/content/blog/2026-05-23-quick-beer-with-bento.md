---
title: Quick Beer with Bento — A Stream Processor for a Warm Afternoon
date: 2026-05-23
author: dataGriff
description: I wanted a stream processor that didn't need a cluster, a JVM, or three hours of setup. One warm afternoon, a barbecue, and a couple of ciders later — I had one.
tags:
- bento
- streaming
- data-engineering
- hungovercoders
---

I wanted a stream processor I could understand between the barbecue cooling down and the sun going in. That's the actual constraint I had in mind — not "I need enterprise-grade Kafka consumer infrastructure," just "I have a warm afternoon, two cans of Tiny Rebel left, and I want something to click before the dogs fall asleep."

I'd had a good one. Allotment in the morning, then down to Dog Trust to walk a few of the big lads who were doing their best panting impression in the heat, then back home for a barbecue in the South Wales sunshine we're only allowed about four times a year. By the time I sat down with a laptop the ambition level was — appropriately — precisely calibrated. Enter **Bento**.

Bento is a fork of Benthos, now maintained by the WarpStream lot. A single static binary that runs a streaming data pipeline from a YAML file. No JVM. No cluster. No Helm chart inheritance hell. One slightly hungover person can deploy it on a Tuesday — which is exactly the worldview I bring to every bit of kit I write about on here. I've been building a [full tutorial series for it](https://hungovercoders.com/training/bento), but this is the short version: here's what it does, here's a working pipeline you can run right now, and here's my honest take after a week of poking at the thing.

dataGriff SMASH.

## Pre-Requisites

- Bento installed — `brew install warpstreamlabs/tap/bento` on Mac, direct binary download on Linux
- A terminal
- A YAML editor (VS Code as always for me)
- Patience for about two indentation errors before everything clicks

## Cracking Open the First Round

A Bento pipeline has three parts: an `input`, optional `pipeline.processors`, and an `output`. That's it. Every config in the [full series](https://hungovercoders.com/training/bento) shares that shape — the only questions are *which* input, *which* processors, and *which* output.

For this one I wanted a taproom order tracker: generate synthetic rounds of craft beer, compute a tab total using Bloblang, classify each order, write every round to a local file, and watch a live dashboard in a second terminal showing the running totals. No database, no broker, no faff. Just evidence that Bento can do real work in about twenty lines of YAML.

Here's the `input`:

```yaml
input:
  generate:
    interval: 500ms
    mapping: |
      let beers = ["tiny-ipa","mango-punk","cwtch","dirty-stop-out","clwb-trop"]
      root.round     = uuid_v4()
      root.beer      = $beers.index(random_int(min:0, max:4))
      root.pints     = random_int(min:1, max:4)
      root.price_per = random_int(min:5, max:8)
      root.ts        = now()
```

`input.generate` is Bento's built-in fake-message producer — no external system, just a Bloblang mapping that fires on a timer. `let` declares local variables; `.index(random_int(...))` picks a random element from the array. `uuid_v4()` and `now()` are built-in Bloblang functions. Two rounds per second, indefinitely. Ctrl-C when you've had enough.

## Pouring the Logic — the Bloblang Processor

This is where Bento earns its keep:

```yaml
pipeline:
  processors:
    - mapping: |
        root = this
        root.tab_total = this.pints * this.price_per
        root.verdict = match {
          root.tab_total >= 25 => "big round, respect",
          root.tab_total >= 15 => "steady on",
          _                    => "one for the road",
        }
```

`root = this` copies the incoming payload as the starting point — you're mutating, not rebuilding. The `tab_total` is a straightforward multiply. The `match` expression is Bloblang's switch: top-to-bottom, first match wins, bare `_` is the default. Clean, readable, and lint-able before it ever touches a real message.

**Bloblang** is Bento's mapping language and it's genuinely its own thing — not JSON Path, not Python, not Go templates, just Bloblang. You have to read the docs rather than guess your way through it. The [cheatsheet lesson](https://hungovercoders.com/training/bento/06-bloblang-cheatsheet) in the series has the bits I reach for most often; worth bookmarking.

## Calling Last Orders — the Output

One output wasn't enough. I wanted the stream in the terminal *and* a file building up on disk so I could query it. Bento's `broker` output with `fan_out` handles this — publish every message to every output simultaneously, no copies, no faffing about:

```yaml
output:
  broker:
    pattern: fan_out
    outputs:
      - stdout: {}
      - file:
          path: ./out/rounds.jsonl
          codec: lines
```

`codec: lines` means one complete JSON object per line — standard JSONL format, readable with `cat`, queryable with `jq`. Bento creates the `./out/` directory if it doesn't exist. You get the live terminal feed and a file that accumulates every round as long as the pipeline runs.

## Getting the Round In — Running It

Save all three sections as `config.yaml` and run:

```bash
bento -c config.yaml
```

You should see something like this rolling down the terminal:

```json
{"round":"a1b2...","beer":"mango-punk","pints":3,"price_per":7,"ts":"...","tab_total":21,"verdict":"steady on"}
{"round":"c3d4...","beer":"tiny-ipa","pints":4,"price_per":8,"ts":"...","tab_total":32,"verdict":"big round, respect"}
{"round":"e5f6...","beer":"cwtch","pints":1,"price_per":5,"ts":"...","tab_total":5,"verdict":"one for the road"}
```

I'll be honest — I wrote this sat in the garden, laptop on my knee, last of the sun going in. First run it all worked and I thought I'd set the interval too short. Nope. That's just how fast a static binary with no JVM warm-up actually is. Half a second between rounds, exactly as configured, Ctrl-C to stop. A stream processor with real transformation logic in twenty lines of YAML, and I understood every line before my cider went warm.

## Keeping Tabs — the Live Dashboard

With rounds landing in `./out/rounds.jsonl`, crack open a second terminal and watch the stream as a human-readable feed:

```bash
tail -f ./out/rounds.jsonl \
  | jq -r '"[\(.verdict | ascii_upcase)] \(.beer) — \(.pints) pints @ £\(.price_per) = £\(.tab_total)"'
```

Output:

```
[STEADY ON] mango-punk — 3 pints @ £7 = £21
[BIG ROUND, RESPECT] tiny-ipa — 4 pints @ £8 = £32
[ONE FOR THE ROAD] cwtch — 1 pints @ £5 = £5
```

Or if you want a live scoreboard of the verdict categories — open a third terminal and run:

```bash
watch -n 2 'echo "=== Tab Report ===" && jq -r ".verdict" ./out/rounds.jsonl | sort | uniq -c | sort -rn'
```

Which gives you something like this, refreshing every two seconds:

```
=== Tab Report ===
  14 steady on
   9 one for the road
   7 big round, respect
```

No Grafana. No Prometheus. No infrastructure. Just `watch`, `jq`, and a JSONL file that Bento is quietly filling up in the background. Genuinely one of my favourite moments in building this post — the terminal equivalent of watching the tab rack up on a Friday.

## The Complete Config

```yaml
input:
  generate:
    interval: 500ms
    mapping: |
      let beers = ["tiny-ipa","mango-punk","cwtch","dirty-stop-out","clwb-trop"]
      root.round     = uuid_v4()
      root.beer      = $beers.index(random_int(min:0, max:4))
      root.pints     = random_int(min:1, max:4)
      root.price_per = random_int(min:5, max:8)
      root.ts        = now()

pipeline:
  processors:
    - mapping: |
        root = this
        root.tab_total = this.pints * this.price_per
        root.verdict = match {
          root.tab_total >= 25 => "big round, respect",
          root.tab_total >= 15 => "steady on",
          _                    => "one for the road",
        }

output:
  broker:
    pattern: fan_out
    outputs:
      - stdout: {}
      - file:
          path: ./out/rounds.jsonl
          codec: lines
```

## Would I Actually Use Bento?

Honest take, post-barbecue.

**For a tactical glue pipeline — yes, immediately.** The single-binary deployment story is genuinely the killer feature. Drop it on a server, a container, or a developer's laptop and it works. No JVM tuning, no cluster, no Helm chart. For "I need to move data from A to B with a bit of transformation in the middle" — which is most of what teams actually need — Bento is enough, and it's a lot less hassle than the alternatives.

**For a stateful 24/7 high-volume thing — I'd still pick Flink.** Bento has windowing and aggregation (there's a [whole lesson on it](https://hungovercoders.com/training/bento/16-windowing-aggregation)), but it's not pretending to be a full streaming database. If your problem includes "exactly-once at petabyte scale" you want the heavy machinery.

**The honest friction**: Bloblang is its own thing and the error messages when you get the indentation wrong are characterful. The YAML also gets surprisingly large on a real pipeline — once you're wiring together DLQ routing, HTTP enrichment, and windowed aggregation you're looking at a proper config. Not a dealbreaker, just a thing I'd tell you before you put it in production.

The worldview fit is what keeps me coming back. Bento is **small, cheap, source-controlled, and deployable by one slightly hungover person on a Tuesday**. Most teams don't need the Ferrari. They need the reliable estate car that fits the dogs in the boot. Bento is that car.

If I were doing this post again I'd add a second example with a real file input straight after — the pivot from `generate` to reading an actual CSV is where it stops feeling like a toy and starts feeling like a production tool, and the step is genuinely tiny.

The [full learn.bento tutorial series](https://hungovercoders.com/training/bento) covers everything from hello world through WarpStream, windowing, enrichment, DLQ error handling, and pipeline testing — twenty-two lessons, all with runnable configs. Fork the [repo](https://github.com/hungovercoders/learn.bento), clone it, crack on.

Well done on your first Bento pipeline, fellow hungovercoder. I'm going to go and see if there are any sausages left.
