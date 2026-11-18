-- ============================================================================
-- CityPulse Civic Platform — Supabase Initial Seed Data
-- Run AFTER 01_schema.sql and 02_rls_policies.sql
-- ============================================================================

-- 1. Global System Settings (matches DEFAULT_SYSTEM_SETTINGS)
insert into public.system_settings (
  id,
  platform_name,
  default_map_style,
  maintenance_mode,
  maintenance_message,
  allow_anonymous_reports,
  auto_assign_department,
  enable_air4thai_layer,
  sla_default_hours,
  max_upload_size_mb,
  xp_rewards
) values (
  'global',
  'CityPulse',
  'voyager',
  false,
  'ระบบกำลังบำรุงรักษาฐานข้อมูลชั่วคราว ขออภัยในความไม่สะดวก',
  true,
  true,
  true,
  48,
  5,
  '{
    "DAILY_CHECKIN": 15,
    "UPVOTE": 5,
    "COMMENT": 10,
    "POLL_VOTE": 20,
    "REPORT": 50,
    "PHOTO_BONUS": 25,
    "RESOLVED_BONUS": 100
  }'::jsonb
)
on conflict (id) do nothing;

-- 2. Initial Civic Polls (matches INITIAL_CIVIC_POLLS)
insert into public.civic_polls (
  id, title, description, location_name, lng, lat, category,
  agree_count, disagree_count, total_votes, proposal_by, end_date
) values
  (
    'poll-1',
    'โครงการติดตั้งทางม้าลายอัจฉริยะพร้อมไฟสัญญาณคนข้าม แยกอโศก',
    'เนื่องจากคนเดินเท้าข้ามถนนหนาแน่น เสนอติดตั้งสัญญาณไฟตรวจจับคนข้ามและกล้องตรวจจับผู้ฝ่าฝืน',
    'สี่แยกอโศก-สุขุมวิท เขตวัฒนา',
    100.5614, 13.7365, 'pedestrian',
    248, 19, 267,
    'เครือข่ายความปลอดภัยคนเดินเท้า',
    '30 ก.ย. 2026'
  ),
  (
    'poll-2',
    'ข้อเสนอขยายทางจักรยานและทางเดินริมคลองแสนแสบ สู่สวนเบญจกิติ',
    'สร้างทางเชื่อมสีเขียวร่มรื่น ลดการใช้รถยนต์ส่วนบุคคล เชื่อมต่อสถานีขนส่งสาธารณะ',
    'สะพานอโศก - ท่าเรือคลองแสนแสบ',
    100.5620, 13.7485, 'environment',
    182, 14, 196,
    'กลุ่มพัฒนาเมืองยั่งยืน',
    '15 ต.ค. 2026'
  ),
  (
    'poll-3',
    'ปรับปรุงจุดเปลี่ยวซอยร่วมฤดี ติดตั้งเสาไฟส่องสว่างโซลาร์เซลล์ 20 ต้น',
    'ซอยย่อยแสงสว่างไม่เพียงพอช่วงดึก ประชาชนเสนอเพิ่มไฟทางและกล้องวงจรปิด',
    'ซอยร่วมฤดี ถนนวิทยุ เขตปทุมวัน',
    100.5470, 13.7380, 'safety',
    310, 8, 318,
    'คณะกรรมการชุมชนร่วมฤดี',
    '5 ต.ค. 2026'
  ),
  (
    'poll-4',
    'โครงการจัดระเบียบที่จอดรถรับส่งและจุดพักไรเดอร์ ถนนสีลม',
    'กำหนดจุดพักรถส่งอาหารเป็นสัดส่วนเพื่อลดการจอดกีดขวางทางเท้าและการจราจรหน้าอาคารสำนักงาน',
    'ถนนสีลม บริเวณหน้าปากซอยคอนแวนต์',
    100.5315, 13.7265, 'traffic',
    215, 42, 257,
    'สมาคมผู้ประกอบการย่านสีลม',
    '20 ต.ค. 2026'
  )
on conflict (id) do nothing;

-- 3. Sample Complaints (first 4 records from INITIAL_COMPLAINTS)
insert into public.complaints (
  id, title, description, category_id, status, priority,
  lng, lat, reporter_name, phone, image_url, image_name,
  province, district, department_id, assigned_officer, upvotes, created_at_label
) values
  (
    'complaint-1',
    'ถนนพระรามที่ 4 มีหลุมขนาดใหญ่',
    'หลุมบ่อขนาดใหญ่กลางถนน ทำให้รถยนต์เสียหายและอาจเกิดอุบัติเหตุได้',
    'road', 'inprogress', 'urgent',
    100.5401, 13.7290, 'สมชาย ใจดี', '081-234-5678',
    '/images/complaints/pothole.jpg', 'pothole-rama4.jpg',
    'กรุงเทพมหานคร', 'เขตปทุมวัน', 'dept-public-works', 'นายวิทยา สมบูรณ์ (ทีมซ่อมบำรุง)',
    42, '8 ก.ย. 2026'
  ),
  (
    'complaint-2',
    'น้ำท่วมขังซอยสุขุมวิท 11',
    'น้ำท่วมขังสูง 30 ซม. หลังฝนตก ท่อระบายน้ำอุดตัน ไม่สามารถสัญจรได้',
    'flood', 'pending', 'high',
    100.5595, 13.7453, 'วิภา มั่นคง', null,
    '/images/complaints/flood.jpg', 'flood-sukhumvit11.jpg',
    'กรุงเทพมหานคร', 'เขตวัฒนา', 'dept-drainage', 'ทีมสูบน้ำเคลื่อนที่เร็ว สรน.',
    38, '9 ก.ย. 2026'
  ),
  (
    'complaint-3',
    'ไฟถนนดับหลายดวงย่านสีลม',
    'ไฟส่องสว่างถนนดับ 4 ดวงติดกัน บริเวณถนนสีลมใกล้แยก ทำให้มืดและเสี่ยงอันตราย',
    'electric', 'resolved', 'medium',
    100.5268, 13.7245, 'อนันต์ สว่างใจ', null,
    null, null,
    'กรุงเทพมหานคร', 'เขตบางรัก', 'dept-traffic', 'สมศักดิ์ ไฟฟ้า (กฟน. สีลม)',
    19, '5 ก.ย. 2026'
  ),
  (
    'complaint-4',
    'ขยะล้นถังบริเวณตลาดนัด MRT จตุจักร',
    'ขยะล้นออกมานอกถัง มีกลิ่นรุนแรง เจ้าหน้าที่ไม่ได้มาเก็บมาหลายวัน',
    'trash', 'pending', 'high',
    100.5498, 13.8012, 'กนกวรรณ สะอาด', null,
    null, null,
    'กรุงเทพมหานคร', 'เขตจตุจักร', 'dept-environment', 'ฝ่ายรักษาความสะอาด เขตจตุจักร',
    27, '9 ก.ย. 2026'
  )
on conflict (id) do nothing;

-- 4. Sample Timeline for complaint-1
insert into public.complaint_timeline (
  id, complaint_id, event_date, event_time, title, description, status, officer, icon
) values
  ('t1-1', 'complaint-1', '8 ก.ย. 2026', '09:15', 'รับเรื่องร้องเรียน', 'ระบบบันทึกเรื่องร้องเรียนจากประชาชนเรียบร้อยแล้ว', 'pending', null, 'inbox'),
  ('t1-2', 'complaint-1', '8 ก.ย. 2026', '10:30', 'ส่งต่อหน่วยงานรับผิดชอบ', 'ส่งเรื่องไปยังกองช่างสุขาภิบาล สำนักงานเขตปทุมวัน', 'pending', 'ระบบอัตโนมัติ', 'paper-plane'),
  ('t1-3', 'complaint-1', '8 ก.ย. 2026', '14:00', 'เจ้าหน้าที่รับเรื่อง', 'นายวิทยา หัวหน้าทีมซ่อมบำรุง รับเรื่องดำเนินการ', 'inprogress', 'วิทยา สมบูรณ์', 'user-check')
on conflict (id) do nothing;

