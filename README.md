# YWD Logger Card

A custom Home Assistant card for quickly logging notes, events, and activities from your dashboard.

YWD Logger Card opens a clean modal interface where you can select a category, type a note, use presets, and view recent entries. It is designed to make lightweight logging fast and easy from within Lovelace.
<img width="540" height="684" alt="ywd-logger" src="https://github.com/user-attachments/assets/e1d8003c-a8de-40c1-bca8-ec11fba65d94" />

## Features

- Dashboard tile that opens a logger modal
- Multiple categories with custom names, icons, colors, and presets
- Quick note entry
- User stamped logs
- User-defined local presets
- Recent entry history shown in the modal
- Smart date formatting:
  - Today at HH:MM
  - Yesterday at HH:MM
  - DD/MM at HH:MM
- Optional hidden-card mode so it can run as a background listener
- GUI editor for configuring title, entity, and categories

## Installation

### Manual installation

1. Copy `ywd-logger-card.js` into your Home Assistant `www` folder:

   ```text
   /config/www/ywd-logger-card.js
   ```

2. Add the resource to Home Assistant:

   **Settings → Dashboards → Resources**

3. Add this resource:

   ```text
   /local/ywd-logger-card.js
   ```

4. Refresh your browser.

## Backend setup

This card also requires a Home Assistant trigger-based template sensor to store and manage log entries.

The card itself does not persist entries on its own. It relies on a template sensor that:

- listens for `logbook_entry` events from the card
- stores entries in the `sensor.ywd_logger_data` attributes
- listens for `ywd_logger_delete_entry` events
- removes matching entries when deleted from the card UI

Add the following to your Home Assistant template configuration:

```yaml
- trigger:
    - platform: event
      event_type: logbook_entry
      event_data:
        domain: ywd_logger_card
      id: "add"

    - platform: event
      event_type: ywd_logger_delete_entry
      id: "delete"

  sensor:
    - name: YWD Logger Data
      unique_id: ywd_logger_card_data
      state: "Active"
      attributes:
        entries: >
          {% set current = state_attr('sensor.ywd_logger_data', 'entries') %}
          {% set current = current if current is not none else [] %}
          {% set current = current | from_json if current is string else current %}

          {% if trigger.id == 'add' %}
            {% set raw_msg = trigger.event.data.message | string %}
            {% set user = "System" %}
            {% set text = raw_msg %}
            {% if raw_msg.startswith('[') and ']' in raw_msg %}
              {% set user = raw_msg.split(']', 1)[0][1:] %}
              {% set text = raw_msg.split(']', 1)[1] | trim %}
            {% endif %}
            {% set new_entry = {
              "ts": (as_timestamp(now()) * 1000) | int,
              "category": trigger.event.data.name,
              "text": text,
              "user": user
            } %}
            {{ ([new_entry] + current)[:30] | to_json }}

          {% elif trigger.id == 'delete' %}
            {% set delete_ts = trigger.event.data.ts | int %}
            {% set ns = namespace(new_list=[]) %}
            {% for item in current %}
              {% if item.ts | int != delete_ts %}
                {% set ns.new_list = ns.new_list + [item] %}
              {% endif %}
            {% endfor %}
            {{ ns.new_list | to_json }}

          {% else %}
            {{ current | to_json }}
          {% endif %}
```

## Basic usage

```yaml
type: custom:ywd-logger-card
title: Logger
icon: mdi:notebook-edit
entity_id: sensor.ywd_logger_data
categories:
  - name: Health
    icon: mdi:medical-bag
    color: "#E8A0BF"
    presets:
      - Took medication
      - Headache
  - name: Home
    icon: mdi:home-outline
    color: "#80CBC4"
    presets:
      - Cleaning
      - Laundry
```

## Configuration

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `title` | string | `Logger` | Card title shown on the tile |
| `icon` | string | `mdi:notebook-edit` | Tile icon |
| `entity_id` | string | `sensor.ywd_logger_data` | Entity used to read logger entries |
| `hidden_card` | boolean | `false` | Hides the tile but keeps the card active as a background listener |
| `categories` | list | See default config | List of categories with names, icons, colors, and presets |

### Category options

Each category supports:

| Name | Type | Description |
|------|------|-------------|
| `name` | string | Category name |
| `icon` | string | MDI icon |
| `color` | string | Hex color |
| `presets` | list | Preset phrases for quick entry |

## Example with hidden card

```yaml
type: custom:ywd-logger-card
hidden_card: true
entity_id: sensor.ywd_logger_data
categories:
  - name: Health
    icon: mdi:medical-bag
    color: "#E8A0BF"
    presets:
      - Took medication
  - name: Home
    icon: mdi:home-outline
    color: "#80CBC4"
    presets:
      - Cleaning
```
## Example automation

Here is an example automation that writes a log entry to the card when an NFC tag is scanned. This version has been anonymised so it is safe to publish.

```yaml
alias: NFC Plants Watered
description: ""
triggers:
  - trigger: tag
    tag_id: your_plants_tag_id
conditions: []
actions:
  - action: logbook.log
    data:
      name: Home
      entity_id: sensor.ywd_logger_data
      domain: ywd_logger_card
      message: >
        {% set scanners = {
          "device_id_1": "Person One (tag)",
          "device_id_2": "Person Two (tag)",
          "device_id_3": "Person Three (tag)"
        } %}
        {% set person = scanners.get(trigger.event.data.device_id, "Someone") %}
        [{{ person }}] Watered plants
  - action: persistent_notification.dismiss
    data:
      notification_id: example_plants_reminder
mode: single
```

### Notes on the example

- Replace `your_plants_tag_id` with your actual NFC tag ID.
- Replace the example `device_id_*` values with your own device IDs if you want to identify who scanned the tag.
- Update the friendly names in the `scanners` dictionary to match your household.
- This example logs to `sensor.ywd_logger_data` using the `ywd_logger_card` domain, so it matches the renamed card and backend template.


## Notes

- User-added presets are stored in browser local storage using the key pattern `ywd_logger_user_presets_<entity_id>`.
- If you previously used the old non-`ywd` version, existing browser-stored presets will not automatically carry across.
- This card expects the matching backend template sensor to be present and using the same entity name as the card config.

## Events and services used

This card currently uses:

- `hass-ywd-logger-open` event to open the modal
- `logbook.log` service to write log entries
- `ywd_logger_card` as the logbook domain
- `events/ywd_logger_delete_entry` API call to delete entries

## Card type

```yaml
type: custom:ywd-logger-card
```

## Credits

Built for personal Home Assistant dashboard use.
