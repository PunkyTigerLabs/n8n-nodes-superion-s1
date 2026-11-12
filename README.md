# n8n-nodes-superion-s1

This is an n8n community node. It lets you use **Superion S1** in your n8n workflows.

Superion S1 by Punky Tiger Labs is a calibrated decision API: send a text and typed questions
(yes/no, choice, score) and get one calibrated probability per question in a single call, without
generating text (sub-second). Use it to triage tickets, moderate content, score leads, route
requests or gate actions in a workflow.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation) · [Operations](#operations) · [Credentials](#credentials) ·
[Compatibility](#compatibility) · [Usage](#usage) · [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
and install `n8n-nodes-superion-s1`.

## Operations

| Operation | What it does |
|---|---|
| **Decide** | Ask any number of questions about a text. Each question is *Yes / No*, *Choice* (2–255 options) or *Score* (2–16 ordered levels). |
| **Get Usage** | Plan, today's counters, limits and Prepaid balance of your key. |
| **List Models** | Served model versions (immutable IDs). |

Decide outputs one field per question ID, ready for an IF or Switch node:

```json
{
  "refund":  { "answer": false, "probability": 0.0012 },
  "team":    { "answer": "billing", "probability": 0.98 },
  "urgency": { "answer": "high", "level": 2, "probability": 0.81, "expectedLevel": 1.79 },
  "usage":   { "input_tokens": 138, "output_tokens": 0 },
  "model":   "superion-s1-v6-int4e-vllm-kv1@sha256:e6dc49dc"
}
```

For yes/no questions `probability` is the probability of *yes*. Turn on *Include Raw Response*
to also get the full API answer. The node is marked *usable as tool*, so AI Agent nodes can call it.

## Credentials

1. Get a free key (100 M input tokens per day, permanent) at https://punkytigerlabs.com/s1/.
2. In n8n create a **Superion S1 API** credential and paste the key (`s1k_…`). Leave the base URL as is.

The credential test calls `GET /v1/usage`.

## Compatibility

Built with `@n8n/node-cli` 0.56 (n8n nodes API version 1, strict mode, no runtime dependencies).
Tested against the live API on 12 Nov 2026.

## Usage

**Options** take one item per line (or comma-separated on one line), with an optional description
after a colon:

```
billing: payments, invoices and refunds
tech: technical problem or bug
sales
```

**Levels** are ordered from lowest to highest. Write instructions as you would for a careful human
reviewer: answers depend on the wording. Because the probabilities are calibrated, a threshold in an
IF node (for example `{{$json.team.probability}} >= 0.8`) means what it says, so you can send only
the uncertain items to a person.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Superion S1 API docs](https://punkytigerlabs.com/s1/docs)

## About Superion S1

**#1 of 213 on S1MB English v1 — Task Average 75.06 · Borda 89.88 (Nov 2026)** —
[leaderboard](https://huggingface.co/datasets/hotchpotch/s1mb-result).
Calibrated probabilities, one call, no text generation, sub-second. Built on Gemma 4 26B-A4B, INT4 experts.

| Plan | Price |
|---|---|
| Free | 100 M input tokens per day per key, permanent |
| Prepaid | 0.042 USD per million input tokens, output free |
| Contract | dedicated key, price on request |

Get a key: https://punkytigerlabs.com/s1/ · Docs: https://punkytigerlabs.com/s1/docs · Status: https://punkytigerlabs.com/s1/status

## Custom & industry models

Punky Tiger Labs also builds custom and industry-specific decision models — fitted to your own
taxonomy, labels and data, for a specific industry or objective — served on a dedicated instance.
Contact: [alvaro.lopez@punkytigerlabs.com](mailto:alvaro.lopez@punkytigerlabs.com).

## License

This client is MIT-licensed (see `LICENSE.md`). The Superion S1 model and API are proprietary
services of Punky Tiger Labs, Inc., used under the [API terms](https://punkytigerlabs.com/s1/terms).
