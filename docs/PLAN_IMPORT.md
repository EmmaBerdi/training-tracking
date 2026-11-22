# Plan import format

Everything needed to write a training plan the app can import. Hand this whole file to an AI
together with your plan (or your goals) and ask for the JSON.

**Importing:** in the app, open **Plan**, then **+ Plan** → **Plan aus JSON importieren**, and
choose the file, drop it in, or paste its content. The app checks the whole file and lists every
problem at once. If it is valid, you assign each `sessionType` to one of your activities, and the
plans are added next to the ones you already have.

The rules are enforced by `frontend/src/state/planImport.ts`; if this document and that file ever
disagree, the code wins.

---

## Instructions for the AI

- Output **only the JSON**: no Markdown code fences, no comments, no explanations. JSON does not allow
  comments or trailing commas.
- Use **only the fields described below**. Leave out optional fields that don't apply rather than
  setting them to `null` or `""`.
- Values in `kind` and `type` must be **exactly** one of the listed lowercase codes.
- `sets`, `setsL` and `setsR` are **whole numbers** (`3`, not `"3"` or `3.0`).
- `reps` is **text** (`"8"`, `"6–8"`, `"45"`), at most 64 characters.
- Write names, notes and descriptions in the language the user writes in (the app itself is
  German).
- One entry in `days` is one workout plan (one training session). A weekly rotation of A/B/C days
  is three entries. Do not try to describe dates or a weekly schedule: plans are scheduled in the
  app's calendar, and unknown fields such as `schedule` are ignored.

---

## Structure

```
{
  warmup?: string[]          // optional
  days:    Day[]             // at least one
}

Day {
  short:        string       // required, ≤ 32 characters
  title:        string       // required, ≤ 255 characters
  sessionType?: string       // optional, ≤ 255 characters
  blocks:       Block[]      // required (may be empty, but should not be)
}

Block {
  kind: "huefte" | "skill" | "kraft" | "explosiv" | "core" | "ausdauer"   // required
  name: string               // required, ≤ 255 characters
  ex:   Exercise[]           // required
}

Exercise {
  name:  string              // required, ≤ 255 characters
  type:  "kg" | "band" | "bw" | "sek" | "min" | "m" | "cm"                // required
  reps:  string              // required, ≤ 64 characters (a plain number is also accepted)
  note?: string              // optional
  desc?: string              // optional

  // either both sides together:
  sets:  integer 0–99        // required unless uni is true
  uni?:  false

  // or one side at a time:
  uni:   true
  setsL: integer 0–99        // required when uni is true
  setsR: integer 0–99        // required when uni is true
}
```

---

## Fields

### Top level

| Field | Required | Meaning |
|---|---|---|
| `warmup` | no | A list of warm-up items, one text each (e.g. `"5 min Rudergerät locker"`). The app keeps **one** warm-up list shared by all plans; on import, items it already has (ignoring case) are not added again. |
| `days` | yes | The workout plans, at least one. |

### Day (one workout plan)

| Field | Required | Meaning |
|---|---|---|
| `short` | yes | Short label on the tab strip, **≤ 32 characters**, e.g. `"Tag A"`, `"OK 1"`, `"Testtag 1"`. |
| `title` | yes | Full name shown as the heading, e.g. `"Unterkörper & Sprungkraft"`. |
| `sessionType` | no | The activity this plan belongs to, e.g. `"Kraft"`, `"Laufen"`, `"Bouldern"`. It is matched against the user's existing activities ignoring upper/lower case. If it doesn't match (or is missing), the user picks the activity during import. Use the same spelling for all days of the same activity. |
| `blocks` | yes | The sections of the workout, in order. |

### Block (a section of the workout)

| Field | Required | Meaning |
|---|---|---|
| `kind` | yes | The block's category; it sets the block's colour. One of the codes below. |
| `name` | yes | The block heading, e.g. `"Sprungtests"`, `"Hauptübungen"`. |
| `ex` | yes | The exercises in this block, in order. |

| `kind` | Use for |
|---|---|
| `huefte` | Hip work: mobility, activation, hip stability |
| `skill` | Technique and skill practice |
| `kraft` | Strength training |
| `explosiv` | Power: jumps, throws, sprints, plyometrics |
| `core` | Trunk / core |
| `ausdauer` | Endurance / conditioning |

### Exercise

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Exercise name. |
| `type` | yes | What the user logs for each set. One of the codes below. |
| `sets` | yes, unless `uni` is `true` | Number of sets, whole number 0–99. Each set becomes one button to log a value. |
| `uni` | no | `true` for exercises done **one side at a time** (single-leg, single-arm). The app then shows a row for the left and a row for the right side. Leave it out (or `false`) otherwise. |
| `setsL`, `setsR` | yes, when `uni` is `true` | Sets for the left and the right side, whole numbers 0–99. Usually the same. Do not give `sets` as well. |
| `reps` | yes | The target per set, as text. Shown on the card as `sets × reps · unit`. See the table below for what it means per `type`. Ranges like `"6–8"` are fine. |
| `note` | no | A short cue shown directly under the sets: rest, tempo, intensity, what to record. E.g. `"2 min Pause, RPE 8"`. Keep it to one line. |
| `desc` | no | A longer how-to (execution, setup, common mistakes), shown behind the ⓘ button. Plain text, a few sentences. |

| `type` | The user logs per set | Shown as | `reps` means |
|---|---|---|---|
| `kg` | the weight used (and the reps done) | kg | target reps, e.g. `"8"` or `"6–8"` |
| `band` | the resistance band used (and the reps done) | Band | target reps |
| `bw` | the number of reps (bodyweight) | Wdh | target reps, e.g. `"10"` or `"max"` |
| `sek` | a duration in seconds | Sek | target seconds, e.g. `"45"` |
| `min` | a duration in minutes | Min | target minutes, e.g. `"20"` |
| `m` | a distance in metres | m | target distance or reps, e.g. `"400"` |
| `cm` | a distance or height in centimetres | cm | attempts per set, usually `"1"` |

Choosing `type`: weighted lifts → `kg`; band exercises → `band`; push-ups, pull-ups, bodyweight
reps → `bw`; holds and planks → `sek`; runs or rides by time → `min`; by distance → `m`; jump tests
→ `cm`.

---

## Limits that cause an import error

- Missing required field, or an empty text where text is required.
- `short` longer than 32 characters; `title`, `sessionType`, `name` longer than 255; `reps` longer
  than 64.
- `kind` or `type` not one of the listed codes.
- `sets` / `setsL` / `setsR` not a whole number from 0 to 99.
- `uni` anything other than `true` or `false`.
- `days` missing or empty; `blocks` or `ex` not a list; `warmup` not a list of texts.

Photos can't be imported; add them to an exercise in the app afterwards.

---

## Complete example

```json
{
  "warmup": [
    "5 min Rudergerät locker",
    "Hüftkreisen 10× je Seite",
    "Ausfallschritt mit Rotation 5× je Seite"
  ],
  "days": [
    {
      "short": "Tag A",
      "title": "Unterkörper & Sprungkraft",
      "sessionType": "Kraft",
      "blocks": [
        {
          "kind": "huefte",
          "name": "Hüfte aktivieren",
          "ex": [
            {
              "name": "Glute Bridge",
              "type": "bw",
              "sets": 2,
              "reps": "15",
              "note": "oben 2 s halten"
            }
          ]
        },
        {
          "kind": "explosiv",
          "name": "Sprünge",
          "ex": [
            {
              "name": "Countermovement-Jump",
              "type": "cm",
              "sets": 3,
              "reps": "1",
              "note": "Hände an der Hüfte, 60 s Pause, besten Wert notieren",
              "desc": "Aus dem Stand schnell in die Hocke gehen und maximal hoch springen. Hände bleiben die ganze Zeit an der Hüfte."
            }
          ]
        },
        {
          "kind": "kraft",
          "name": "Hauptübungen",
          "ex": [
            {
              "name": "Kniebeuge",
              "type": "kg",
              "sets": 4,
              "reps": "6–8",
              "note": "2 min Pause, RPE 8"
            },
            {
              "name": "Bulgarian Split Squat",
              "type": "kg",
              "uni": true,
              "setsL": 3,
              "setsR": 3,
              "reps": "8",
              "note": "Kurzhanteln, 90 s Pause"
            }
          ]
        },
        {
          "kind": "core",
          "name": "Rumpf",
          "ex": [
            {
              "name": "Plank",
              "type": "sek",
              "sets": 3,
              "reps": "45"
            },
            {
              "name": "Seitstütz",
              "type": "sek",
              "uni": true,
              "setsL": 2,
              "setsR": 2,
              "reps": "30"
            }
          ]
        }
      ]
    },
    {
      "short": "Lauf",
      "title": "Lockerer Dauerlauf",
      "sessionType": "Laufen",
      "blocks": [
        {
          "kind": "ausdauer",
          "name": "Lauf",
          "ex": [
            {
              "name": "Dauerlauf Zone 2",
              "type": "min",
              "sets": 1,
              "reps": "40",
              "note": "Puls unter 145"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Prompt to copy

> Below is the import format of my training app. Write my plan as JSON in exactly this format and
> output only the JSON. Follow every rule in the "Instructions for the AI" and "Limits" sections.
>
> My plan / my goals: …
>
> *(paste this document below)*
