---
title: Delightful Local Data Engineering with DuckDB and Harlequin
date: 2026-09-13
author: dataGriff
description: A deliberately small local data setup with DuckDB and Harlequin, querying a folder of craft beer events with no cluster in sight
tags:
  - DuckDB
  - Harlequin
  - Data Engineering
  - hungovercoders
image:
  path: /assets/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/link.png
---

Today I want to start small, with just enough to fit in our heads and really enjoy ourselves developing. If we're not careful some of the joy of engineering can be lost with heavy usage of AI, and whilst AI can accelerate us, lets ensure we use good tools with it that allow us to interact optimally with the things we, or yes AI, are building. An elegant codebase laid out well, coupled with tools that consider the joy of development, make for a happy builder. Two of my favourite data tools for just this are [duckdb](https://duckdb.org) and [harlequin](https://harlequin.sh), lets crack open a can and find out why!

## What we are going to do?

This is the first in a three part series on delightful data development with duckdb, harlequin and [dbt](https://www.getdbt.com/). This first post covers a simple setup for local development with duckdb and harlequin just to realise how enjoyable the tools are to work with before building a more rigorous engineering system around it.

Our codebase today should look not much more than the below:

```text
local-duckdb-demo/
├── data/raw/events/
├── sql/pipeline/
│   ├── 01_clean_events.sql
│   └── 02_daily_summary.sql
├── scripts/
│   ├── generate_fake_events.py
│   └── run_pipeline.py
└── analytics.duckdb
```

That's how it always begins - very small.

![Big Trouble in Duckdb](/assets/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/big_trouble_in_duckdb.png)

## Pre-Requisites

- [VS Code](https://code.visualstudio.com/download) (or your editor of choice)
- [uv](https://docs.astral.sh/uv/) for python and package management
- A terminal

## Setup with UV

First lets use the delightful [uv python package manager](https://docs.astral.sh/uv/) to setup our codebase. After installing run the following commands:

```bash
uv init
uv python pin 3.12
uv add duckdb pandas pyarrow faker harlequin
```

Your repo should end up looking something like this:

![UV Codebase Setup](/assets/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/codebase_uv.png)

## Ok, what did we just install?

We're a bit bleary eyed from the night before and just blindly followed some tutorial on the interweb. Did I just tell you to install duck**d**estroy**b**ackups? Did you inadvertently just download a faker for identity theft? Luckily - no.

### DuckDB

[DuckDB](https://duckdb.org) is an in-process analytics database. Think SQLite but pointed at analytics work - columns, aggregations, big group bys. There's no server and no cluster, it runs inside your python process and it's fast. It's the engine doing the actual work today.

### Harlequin

[Harlequin](https://harlequin.sh) is a SQL IDE that runs in your terminal. It uses duckdb out of the box, so you point it at some files and start querying. It's the bit that makes poking around your data actually enjoyable.

### Pandas

[Pandas](https://pandas.pydata.org) is the python dataframe library. We only use it here to build our fake data and write it out to parquet.

### PyArrow

[PyArrow](https://arrow.apache.org/docs/python/) is what reads and writes the parquet files under the hood. You won't call it directly, it just needs to be installed.

### Faker

[Faker](https://faker.readthedocs.io) makes up realistic looking data for us - names, timestamps, countries - so we've got something to query. Ours is going to run a fake craft beer shop.

Now back to the tutorial - lets make some faking events!

## Generate Fake Events

Keeping in the spirit of simplicity, we're not going to spin up a [kafka](https://kafka.apache.org/) cluster to generate some events, we're going to use a simple python script. We're pretending to run a little online shop that sells [Tiny Rebel](https://www.tinyrebel.co.uk/) beer by the case, and every click, search and checkout throws off an event. Create a file in your repo called `scripts/generate_fake_events.py` and paste the below into it:

```python
from pathlib import Path
from datetime import datetime, timedelta, timezone
import random, uuid
import pandas as pd
from faker import Faker

fake = Faker()
random.seed(42)
Faker.seed(42)

out = Path("data/raw/events")
out.mkdir(parents=True, exist_ok=True)

types = ["page_view","search","product_view","add_to_cart",
         "checkout_started","purchase"]
devices = ["web","ios","android"]

# Our shop sells Tiny Rebel craft beer by the case.
beers = ["Cwtch","Stay Puft","Clwb Tropica","Easy Livin",
         "Hank","Fubar","Juicy","Dutty"]
# Events tied to a specific beer carry a product; browsing and searching don't.
product_events = {"product_view","add_to_cart","checkout_started","purchase"}

customers = [f"drinker_{i:05d}" for i in range(2000)]
end = datetime.now(timezone.utc)
start = end - timedelta(days=30)
rows = []

for _ in range(50_000):
    event_type = random.choices(types, weights=[40,10,22,12,8,8], k=1)[0]
    rows.append({
        "event_id": str(uuid.uuid4()),
        "event_timestamp": start + timedelta(
            seconds=random.randint(0, int((end-start).total_seconds()))
        ),
        "customer_id": random.choice(customers),
        "session_id": str(uuid.uuid4()),
        "event_type": event_type,
        "beer": random.choice(beers) if event_type in product_events else None,
        "device": random.choice(devices),
        "country": fake.country_code(),
        "revenue": round(random.uniform(12,65),2)
                   if event_type == "purchase" else 0.0,
    })

df = pd.DataFrame(rows)
df["day"] = pd.to_datetime(df["event_timestamp"]).dt.date
for day, frame in df.groupby("day"):
    frame.drop(columns=["day"]).to_parquet(
        out / f"events_{day}.parquet", index=False
    )
```

Next run this command which should populate a local data directory with some parquet files:

```bash
uv run python scripts/generate_fake_events.py
```

These parquet files should be seen under the data/raw/events directory:

![Data Directory](/assets/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/data_directory.png)

### Gitignore Alert

We've not added a .gitignore yet and this chunky data is going to happily commit to your source control if we don't do something about it now.

If we run [git](https://git-scm.com/) status now we'll see the data directory (among others):

```sh
git status
```

For a more dramatic outlook, see your IDEs source control change GUI and it will show a load of useless parquet files being added to your repo.

![Data Files Under Git](/assets/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/data_git.png)

Create a .gitignore file in your repo and add the following content to it.

```gitignore
# Python
__pycache__/
*.py[cod]
.venv/

# DuckDB
*.duckdb
*.duckdb.wal

# dbt
target/
dbt_packages/
logs/

# Local data
data/

# Environment / secrets
.env
.env.*
!.env.example

# OS / editors
.DS_Store
.vscode/
.idea/
```

Now if we run:

```sh
git status
```

Ahh much better, no chonky data in our git repo.

![Git Status Ignored](/assets/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/git_status_ignored.png)

## Harlequin, it makes me Happy

Next we're going to use harlequin to query the fake data we've generated immediately. Its a lovely little tool that lets you query that pesky data with duckdb immediately during your local dev.

Run the following in the terminal to query the data immediately in harlequin:

```bash
uv run harlequin
```

![Harlequin](/assets/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/harlequin.png)

Add the following query:

```sql
select event_type, count(*) as events, sum(revenue) as revenue
from read_parquet('data/raw/events/*.parquet')
group by event_type
order by events desc;
```

Then press CTRL + Enter to run to get the results:

![Harlequin First Query](/assets/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/harlequin_first_query.png)

The default database adapter for harlequin is duckdb so its using the duckdb query engine under the hood to execute SQL queries. We're also keeping this as simple as possible and its using an in-memory duckdb session that doesn't persist any metadata at this point (more to come on this in the second blog in the series where we'll use a .duckdb file for persistence!).

Lets also have a quick look at which beers are actually selling:

```sql
select beer, count(*) as purchases, round(sum(revenue),2) as revenue
from read_parquet('data/raw/events/*.parquet')
where event_type = 'purchase'
group by beer
order by revenue desc;
```

If you're a data analyst or data engineer I strongly recommend you take pause here and realise what just happened. You just queried some data on your local machine with no behemoth setup or compute. Its been so easy you might not have noticed its significance. Duckdb plus harlequin makes it insanely simple to query some data. Take your hands off the keys, sip from your tea or rum, and meditate on the delight you just experienced.

### Harlequin Theme

We all like a theme and harlequin provides this ability. I tend to be a bit of a dracula fan and with halloween season in the air why not give it a go!

```sh
uv run harlequin --theme dracula analytics.duckdb
```

Will give you that classic dracula feel for harlequin.

![Dracula Theme](/assets/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/dracula_theme.png)

### Harlequin Config

Passing flags every time gets old fast. Harlequin will read a `harlequin.toml` from the current directory (or a `[tool.harlequin]` block in your `pyproject.toml`), so you can set your defaults once. Drop this in the root of your repo:

```toml
[harlequin]
theme = "dracula"
limit = 500
```

Now a plain `uv run harlequin analytics.duckdb` starts up dracula themed with your row limit and no flags needed.

### Harlequin Cheat Sheet

You should go to the official [harlequin key bindings](https://harlequin.sh/docs/bindings) for the full list, but below is an even cheatier cheat sheet of what's good to know to get up and running:

| Keys | What it does |
| --- | --- |
| `Ctrl + Enter` | Run the current query |
| `Ctrl + N` | Open a new query tab |
| `F5` | Refresh the data catalog on the left |
| `Ctrl + B` | Toggle the catalog sidebar |
| `Ctrl + S` | Save the current query to a file |
| `Ctrl + Q` | Quit harlequin |

Ctrl + S is a good habit to get into. Save your queries into a local `queries/` folder and they're in source control with the rest of the project, ready to run again next time.

## Deliberately Simple Data Pipeline

That's right we're taking it damn easy today. We are not going to complicate a thing! The next piece of our puzzle is a data pipeline that we can run on our machine without breaking a sweat. The first part of this is going to create a single parquet file for all the events and clean them up with simple type checks.

Add this script to `sql/pipeline/01_clean_events.sql`:

```sql
COPY (
  select
    event_id,
    cast(event_timestamp as timestamp) as event_timestamp,
    cast(event_timestamp as date) as event_date,
    customer_id, session_id,
    lower(event_type) as event_type,
    beer,
    lower(device) as device,
    upper(country) as country,
    cast(revenue as double) as revenue
  from read_parquet('data/raw/events/*.parquet')
  where event_id is not null and customer_id is not null
)
TO 'data/clean/events.parquet' (FORMAT PARQUET);
```

Then to create a summary table, add this script to `sql/pipeline/02_daily_summary.sql`:

```sql
COPY (
  select
    event_date, event_type, beer, device, country,
    count(*) as event_count,
    count(distinct customer_id) as unique_customers,
    count(distinct session_id) as unique_sessions,
    sum(revenue) as revenue
  from read_parquet('data/clean/events.parquet')
  group by 1,2,3,4,5
)
TO 'data/summary/daily_events.parquet' (FORMAT PARQUET);
```

To orchestrate this maze of SQL complexity (kidding) now create a python file in `scripts/run_pipeline.py` with the following contents:

```python
from pathlib import Path
import duckdb

# Ensure output directories exist before DuckDB writes files.
Path("data/clean").mkdir(parents=True, exist_ok=True)
Path("data/summary").mkdir(parents=True, exist_ok=True)

with duckdb.connect(":memory:") as con:
    for file in [
        "sql/pipeline/01_clean_events.sql",
        "sql/pipeline/02_daily_summary.sql",
    ]:
        con.execute(Path(file).read_text())

print("Pipeline complete")
```

All this does is loop over the two sql files we created previously and executes them. Crude but simple for what we are doing here, we need no more at this point. We can then run the following to execute the pipeline:

```bash
uv run python scripts/run_pipeline.py
```

You should see a "Pipeline complete" message and the parquet data visible in your local directories.

![Data Pipeline Data](/assets/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/data_pipeline_data.png)

Living the data engineering dream with a simple pipeline for a simple task - no big data problems here nor should we introduce them. Lets enjoy ourselves!

Lets go back into harlequin for fun and query our summary data. First make a new tab by hitting CTRL+N. Then paste in the following sql and hit CTRL+Enter to query:

```sql
select *
from read_parquet('data/summary/*.parquet')
```

Tada!

![Harlequin Summary Query](/assets/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/harlequin_summary_query.png)

## hsql

But wait... there's more!

Harlequin comes with [hsql](https://harlequin.sh/docs/hsql) for headless interactions. This is the tooling that is going to make pure cli enthusiasts and agents down tequilas and dance like its 1999.

```bash
uv run hsql \
  -c "select * from read_parquet('data/summary/*.parquet') limit 10;"
```

![hsql First Query](/assets/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/hsql_first_query.png)

You can output to different formats such as csv:

```bash
uv run hsql --csv \
  -c "select * from read_parquet('data/summary/*.parquet') limit 10;"
```

Among others everyones favourite these days - markdown! Below is outputting the markdown to a persisted file too. We make the output directory first so the redirect has somewhere to land.

```bash
mkdir -p data/markdown
uv run hsql --markdown \
  -c "select * from read_parquet('data/summary/*.parquet');" > data/markdown/summary.md
```

![hsql Markdown](/assets/2026-09-13-delightful-local-data-engineering-with-duckdb-and-harlequin/hsql_markdown.png)

That's a nice little taster of what the tool can offer and we'll be using this a lot more in upcoming parts of the series.

## Shortcomings and Next Steps

There are some shortcomings to this quick demo that make it a bit light for a production-worthy setup. There's no persistence, no environment awareness and no tests to speak of. It was nice to delicately dip our toe into this technology though just for fun, and for local mooching about with some data I'd reach for duckdb and harlequin every time.

Next steps in parts 2 and 3 we'll get some environment awareness, persisted duckdb metadata, data pipeline testing capabilities and a live environment! If I did this bit again I'd use a .duckdb file from the first query instead of the in-memory session, just so nothing disappears when you close the tool.

To see the most up to date version of this code check out the repo at [github.com/hungovercoders/learn.harlequin](https://github.com/hungovercoders/learn.harlequin). Crack open a can and watch this space for part two.
