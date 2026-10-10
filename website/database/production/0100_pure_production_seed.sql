-- 0100_pure_production_seed.sql — PURE Osaka production reference data.
--
-- Applied once, inside the same transaction as the business core and the
-- access policy (scripts/production-db-init.mjs). Production carries only what
-- the store-side VIP Manager needs to run the floor:
--
--   * the VIP floor section and its five tables VIP01..VIP05, with the same
--     public resource codes as development (public booking joins depend on
--     them) and the VIP Manager plan geometry (pure_vipapp pureFloorPlan.ts);
--   * one booking offering per table, so staff can record a plan;
--   * business days for the next 120 nights (open every night, 22:00–05:00);
--     further nights are opened from the VIP Manager (ensure_admin_event_day_v80).
--
-- Deliberately absent until the owner approves them for opening: ticket
-- sessions, publications and products, VIP booking slots (fees and
-- cancellation terms), and the development verification data. Capacities and
-- minimum spends below are provisional verification values, not approved
-- operating limits or prices.

INSERT INTO public.app_settings (key, value_json) VALUES
  ('vip_floor_v2_dual_write', 'false'::jsonb),
  ('admin_hold_default_expiry_minutes', '{"minutes": 1440, "decision": "PURE production default", "decided_at": "2026-10-10T00:00:00+09:00"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.floor_sections (code, name, sort_order, active) VALUES
  ('pure_vip', 'PURE VIP', 0, true),
  ('pure_history_archive', 'VIP HISTORY / HIDDEN', 999, false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.seat_resources (
  public_resource_code, name, capacity_min, capacity_max, active,
  floor_section_id, display_code, sort_order, shape,
  x_percent, y_percent, width_percent, height_percent, rotation_degrees,
  online_eligible
)
SELECT v.code, v.display_code, 1, v.capacity_max, true,
       fs.id, v.display_code, v.sort_order, 'rect',
       v.x, v.y, v.w, v.h, 0, true
FROM (VALUES
  ('pure-set-1',  'VIP01', 1, 10, 49.80, 18.76, 28.71, 30.09),
  ('pure-set-3',  'VIP02', 2,  8, 76.87, 15.54, 14.12, 23.66),
  ('vip-4',       'VIP03', 3,  6, 90.72, 15.54, 13.18, 23.66),
  ('floor-vip-5', 'VIP04', 4,  6, 68.94, 45.19, 11.82, 21.73),
  ('pure-set-2',  'VIP05', 5, 12, 87.19, 75.96, 20.25, 40.58)
) AS v(code, display_code, sort_order, capacity_max, x, y, w, h)
CROSS JOIN public.floor_sections fs
WHERE fs.code = 'pure_vip'
ON CONFLICT (public_resource_code) DO NOTHING;

INSERT INTO public.booking_offerings (public_offering_id, name, min_guests, max_guests, min_spend_yen, active) VALUES
  ('pure-set-premium', 'PURE SET PREMIUM', 1, 10, 90000, true),
  ('pure-set',         'PURE SET',         1, 12, 80000, true),
  ('pure-set-c',       'PURE SET C',       1,  8, 70000, true),
  ('vip-set',          'VIP SET',          1,  6, 60000, true),
  ('floor-vip',        'FLOOR VIP',        1,  6, 50000, true)
ON CONFLICT (public_offering_id) DO NOTHING;

INSERT INTO public.resource_groups (name, active) VALUES ('floor-vip-pool', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.resource_group_members (resource_group_id, seat_resource_id)
SELECT g.id, s.id
FROM public.resource_groups g
JOIN public.seat_resources s ON s.public_resource_code = 'floor-vip-5'
WHERE g.name = 'floor-vip-pool'
ON CONFLICT DO NOTHING;

INSERT INTO public.offering_resource_requirements (booking_offering_id, seat_resource_id, quantity)
SELECT bo.id, sr.id, 1
FROM public.booking_offerings bo
JOIN public.seat_resources sr ON sr.public_resource_code = CASE bo.public_offering_id
  WHEN 'pure-set-premium' THEN 'pure-set-1'
  WHEN 'pure-set'         THEN 'pure-set-2'
  WHEN 'pure-set-c'       THEN 'pure-set-3'
  WHEN 'vip-set'          THEN 'vip-4'
END
WHERE bo.public_offering_id IN ('pure-set-premium', 'pure-set', 'pure-set-c', 'vip-set')
  AND NOT EXISTS (
    SELECT 1 FROM public.offering_resource_requirements r WHERE r.booking_offering_id = bo.id
  );

INSERT INTO public.offering_resource_requirements (booking_offering_id, resource_group_id, quantity)
SELECT bo.id, g.id, 1
FROM public.booking_offerings bo
JOIN public.resource_groups g ON g.name = 'floor-vip-pool'
WHERE bo.public_offering_id = 'floor-vip'
  AND NOT EXISTS (
    SELECT 1 FROM public.offering_resource_requirements r WHERE r.booking_offering_id = bo.id
  );

-- Open every night. The sales window mirrors development (12:00 → next 05:00
-- JST); public sales stay closed by the deployment's feature flags.
INSERT INTO public.event_days (business_date, venue_timezone, sales_open_at, sales_close_at, operating_status)
SELECT d::date, 'Asia/Tokyo',
       (d::date + interval '12 hours') AT TIME ZONE 'Asia/Tokyo',
       (d::date + interval '1 day' + interval '5 hours') AT TIME ZONE 'Asia/Tokyo',
       'open'
FROM generate_series(
  (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date - 1,
  (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date + 120,
  interval '1 day'
) AS d
ON CONFLICT (business_date) DO NOTHING;
