# Shared date picker

Use `SharedDatePicker` for date-only fields. Mobile uses day/month/year wheels with confirmation and cancellation; web uses the browser calendar. Values and callbacks use `YYYY-MM-DD`, independent of the display language.

```tsx
<SharedDatePicker value={date} onChange={setDate} label="Payment date" maximumDate={reportToday()} />
```

- `minimumDate` / `maximumDate`: inclusive ISO date bounds. Use `reportToday()` as the maximum for historical dates; omit it for future dates.
- `earliestYear`: defaults to 1900. Without a maximum, dates through the current year plus 10 years are available.
- `clearable`: false by default; enable for optional dates and open-ended filters. Clearing emits an empty string.
- `disabled`: prevents changes.
- `label`: accessible name and picker title. Built-in labels support English and Bangla.

`ReportDateField` adds previous/next-day arrows and a today maximum. `DateTimeField` adds hour, minute and AM/PM controls and retains timestamp validation. `BackdatedSaleDateField` adds a 2000 start year, today maximum and compact web width.

Changing month/year clamps invalid days to the last valid day. Date-only limits include both endpoints. Date/time callers retain ownership of timestamp and seconds serialization.

Run date-boundary checks with `node --test mobile/scripts/shared-date.test.mjs`.
