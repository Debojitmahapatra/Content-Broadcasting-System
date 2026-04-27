/**
 * Scheduling Engine Tests – rotation logic + time-window edge cases
 *
 * All tests are pure (no DB) — the rotation algorithm is inlined.
 */

// ---------------------------------------------------------------------------
// Inline pure rotation logic (mirrors schedulingEngine.js)
// ---------------------------------------------------------------------------

function resolveActiveItem(activeItems, scheduleCreatedAt, currentTime) {
  const sorted = [...activeItems].sort((a, b) => a.rotation_order - b.rotation_order);

  const totalCycleDuration = sorted.reduce(
    (sum, item) => sum + item.duration_minutes * 60,
    0
  );

  const elapsedMs = currentTime.getTime() - new Date(scheduleCreatedAt).getTime();
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const offsetSeconds =
    ((elapsedSeconds % totalCycleDuration) + totalCycleDuration) % totalCycleDuration;

  let accumulated = 0;
  for (const item of sorted) {
    const slotDuration = item.duration_minutes * 60;
    if (offsetSeconds < accumulated + slotDuration) {
      const remainingSeconds = accumulated + slotDuration - offsetSeconds;
      return { activeItem: item, remainingSeconds, offsetSeconds };
    }
    accumulated += slotDuration;
  }

  const first = sorted[0];
  return {
    activeItem: first,
    remainingSeconds: first.duration_minutes * 60,
    offsetSeconds,
  };
}

/**
 * Simulates fetchActiveItems time-window filtering.
 * Returns only items whose content window covers currentTime (UTC).
 */
function filterActiveItems(items, currentTime) {
  const now = currentTime.getTime();
  return items.filter((item) => {
    const { start_time, end_time } = item.Content;
    if (!start_time || !end_time) return false;
    const start = new Date(start_time).getTime();
    const end = new Date(end_time).getTime();
    // start_time <= now AND end_time > now
    return start <= now && end > now;
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ANCHOR = new Date('2025-01-01T00:00:00.000Z');

function secondsAfterAnchor(s) {
  return new Date(ANCHOR.getTime() + s * 1000);
}

// 3 items × 5 min = 900 s cycle, all with wide-open time windows
const THREE_ITEMS = [
  {
    id: 1, rotation_order: 1, duration_minutes: 5,
    Content: { id: 1, title: 'Algebra', start_time: '2020-01-01T00:00:00Z', end_time: '2099-12-31T23:59:59Z' },
  },
  {
    id: 2, rotation_order: 2, duration_minutes: 5,
    Content: { id: 2, title: 'Geometry', start_time: '2020-01-01T00:00:00Z', end_time: '2099-12-31T23:59:59Z' },
  },
  {
    id: 3, rotation_order: 3, duration_minutes: 5,
    Content: { id: 3, title: 'Calculus', start_time: '2020-01-01T00:00:00Z', end_time: '2099-12-31T23:59:59Z' },
  },
];

// ---------------------------------------------------------------------------
// Rotation tests
// ---------------------------------------------------------------------------

describe('resolveActiveItem – basic rotation', () => {
  test('returns item 1 at offset 0', () => {
    const { activeItem, remainingSeconds } = resolveActiveItem(THREE_ITEMS, ANCHOR, secondsAfterAnchor(0));
    expect(activeItem.id).toBe(1);
    expect(remainingSeconds).toBe(300);
  });

  test('returns item 1 at offset 299 (last second of slot)', () => {
    const { activeItem, remainingSeconds } = resolveActiveItem(THREE_ITEMS, ANCHOR, secondsAfterAnchor(299));
    expect(activeItem.id).toBe(1);
    expect(remainingSeconds).toBe(1);
  });

  test('returns item 2 at offset 300', () => {
    expect(resolveActiveItem(THREE_ITEMS, ANCHOR, secondsAfterAnchor(300)).activeItem.id).toBe(2);
  });

  test('returns item 3 at offset 600', () => {
    expect(resolveActiveItem(THREE_ITEMS, ANCHOR, secondsAfterAnchor(600)).activeItem.id).toBe(3);
  });

  test('wraps back to item 1 at offset 900', () => {
    expect(resolveActiveItem(THREE_ITEMS, ANCHOR, secondsAfterAnchor(900)).activeItem.id).toBe(1);
  });

  test('wraps correctly after many full cycles', () => {
    expect(resolveActiveItem(THREE_ITEMS, ANCHOR, secondsAfterAnchor(900 * 10 + 150)).activeItem.id).toBe(1);
  });
});

describe('resolveActiveItem – single item', () => {
  const SINGLE = [{ id: 99, rotation_order: 1, duration_minutes: 10 }];

  test('always returns the only item', () => {
    expect(resolveActiveItem(SINGLE, ANCHOR, secondsAfterAnchor(0)).activeItem.id).toBe(99);
  });

  test('loops after its duration', () => {
    expect(resolveActiveItem(SINGLE, ANCHOR, secondsAfterAnchor(601)).activeItem.id).toBe(99);
  });
});

describe('resolveActiveItem – variable durations', () => {
  const MIXED = [
    { id: 10, rotation_order: 1, duration_minutes: 2 },
    { id: 20, rotation_order: 2, duration_minutes: 8 },
  ];

  test('item A active for first 120 s', () => {
    expect(resolveActiveItem(MIXED, ANCHOR, secondsAfterAnchor(0)).activeItem.id).toBe(10);
    expect(resolveActiveItem(MIXED, ANCHOR, secondsAfterAnchor(119)).activeItem.id).toBe(10);
  });

  test('item B active from 120 s to 599 s', () => {
    expect(resolveActiveItem(MIXED, ANCHOR, secondsAfterAnchor(120)).activeItem.id).toBe(20);
    expect(resolveActiveItem(MIXED, ANCHOR, secondsAfterAnchor(599)).activeItem.id).toBe(20);
  });

  test('wraps back to item A at 600 s', () => {
    expect(resolveActiveItem(MIXED, ANCHOR, secondsAfterAnchor(600)).activeItem.id).toBe(10);
  });

  test('remainingSeconds is correct mid-slot', () => {
    const { remainingSeconds } = resolveActiveItem(MIXED, ANCHOR, secondsAfterAnchor(360));
    expect(remainingSeconds).toBe(240);
  });
});

describe('resolveActiveItem – rotation_order independence', () => {
  test('sorts by rotation_order regardless of array order', () => {
    const shuffled = [
      { id: 3, rotation_order: 3, duration_minutes: 5 },
      { id: 1, rotation_order: 1, duration_minutes: 5 },
      { id: 2, rotation_order: 2, duration_minutes: 5 },
    ];
    expect(resolveActiveItem(shuffled, ANCHOR, secondsAfterAnchor(0)).activeItem.id).toBe(1);
  });
});

describe('resolveActiveItem – negative elapsed (clock skew)', () => {
  test('handles currentTime before scheduleCreatedAt gracefully', () => {
    // offset = ((-10 % 900) + 900) % 900 = 890 → item 3 (600–899)
    expect(resolveActiveItem(THREE_ITEMS, ANCHOR, secondsAfterAnchor(-10)).activeItem.id).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Time-window filtering tests
// ---------------------------------------------------------------------------

describe('filterActiveItems – time-window edge cases', () => {
  const NOW = new Date('2025-06-01T12:00:00.000Z');

  test('includes content whose window covers now', () => {
    const items = [
      {
        id: 1, rotation_order: 1, duration_minutes: 5,
        Content: { start_time: '2025-01-01T00:00:00Z', end_time: '2025-12-31T23:59:59Z' },
      },
    ];
    expect(filterActiveItems(items, NOW)).toHaveLength(1);
  });

  test('excludes content with end_time in the past (expired)', () => {
    const items = [
      {
        id: 2, rotation_order: 1, duration_minutes: 5,
        Content: { start_time: '2024-01-01T00:00:00Z', end_time: '2024-12-31T23:59:59Z' },
      },
    ];
    expect(filterActiveItems(items, NOW)).toHaveLength(0);
  });

  test('excludes content with start_time in the future', () => {
    const items = [
      {
        id: 3, rotation_order: 1, duration_minutes: 5,
        Content: { start_time: '2026-01-01T00:00:00Z', end_time: '2026-12-31T23:59:59Z' },
      },
    ];
    expect(filterActiveItems(items, NOW)).toHaveLength(0);
  });

  test('excludes content with end_time exactly equal to now (boundary)', () => {
    const items = [
      {
        id: 4, rotation_order: 1, duration_minutes: 5,
        Content: { start_time: '2025-01-01T00:00:00Z', end_time: NOW.toISOString() },
      },
    ];
    // end_time > now is required; equal means expired
    expect(filterActiveItems(items, NOW)).toHaveLength(0);
  });

  test('excludes content with missing time fields', () => {
    const items = [
      { id: 5, rotation_order: 1, duration_minutes: 5, Content: { start_time: null, end_time: null } },
    ];
    expect(filterActiveItems(items, NOW)).toHaveLength(0);
  });

  test('mixed: only in-window items returned', () => {
    const items = [
      {
        id: 10, rotation_order: 1, duration_minutes: 5,
        Content: { start_time: '2025-01-01T00:00:00Z', end_time: '2025-12-31T23:59:59Z' }, // active
      },
      {
        id: 11, rotation_order: 2, duration_minutes: 5,
        Content: { start_time: '2024-01-01T00:00:00Z', end_time: '2024-06-01T00:00:00Z' }, // expired
      },
      {
        id: 12, rotation_order: 3, duration_minutes: 5,
        Content: { start_time: '2026-01-01T00:00:00Z', end_time: '2026-12-31T23:59:59Z' }, // future
      },
    ];
    const result = filterActiveItems(items, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(10);
  });
});
