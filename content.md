# ข้อกำหนดและมาตรฐานเนื้อหาของระบบ (Content Guidelines)

เอกสารนี้ระบุข้อกำหนดในการพัฒนาและจัดการเนื้อหา (UI Content & UX Patterns) ของระบบ **MapCN System / CityPulse**:

---

## 1. ข้อกำหนดการไม่ใช้อิโมจิ (No Emojis)
* **ห้ามใช้อิโมจิ (Emoji) ทุกชนิดในระบบและข้อความ UI โดยเด็ดขาด**
* สำหรับสัญลักษณ์ ไอคอน หรือการตกแต่ง ให้ใช้ **ไอคอนฟอนต์มาตรฐาน (`JKIcon` / Font Awesome Pro)** หรือ **ตัวการ์ตูนมาสคอต (Mascot Vector/PNG)** แทนเท่านั้น
* เหตุผล: เพื่อความเป็นมืออาชีพ ความเป็นอันหนึ่งอันเดียวกันของดีไซน์ (Design System Consistency) และการแสดงผลที่คมชัดสม่ำเสมอบนทุกอุปกรณ์และเบราว์เซอร์

---

## 2. ข้อกำหนดไม่ใช้ Browser Prompt หรือ Confirm Dialog (No `prompt` / `confirm`)
* **ห้ามใช้ฟังก์ชันของเบราว์เซอร์:**
  * `window.prompt()`
  * `window.confirm()`
  * `window.alert()`
* **แนวทางปฏิบัติ:**
  * หากต้องการให้ผู้ใช้ยืนยันการกระทำ (Confirmation) หรือกรอกข้อมูล ให้ใช้ **Custom Modal, Offcanvas หรือ Popover Dialog** ที่ออกแบบตาม Design System ของแอปพลิเคชัน
  * สำหรับข้อความแจ้งเตือน ให้ใช้ **Custom Toast Notification หรือ Feedback Banner**
  * เหตุผล: Dialog พื้นฐานของระบบเบราว์เซอร์ทำให้ประสบการณ์ผู้ใช้ (UX) สะดุด ไม่สามารถปรับแต่งธีม (Dark/Light) ได้ และบล็อกการทำงานของ Thread หน้าเว็บ (Thread-blocking)

---

## 3. มาตรฐานการแสดงผลไอคอนและสัญลักษณ์ทดแทน
* ไอคอนแสดงความเร่งด่วน/ฮิต: ใช้ `<JKIcon name="fire" />` แทน 🔥
* ไอคอนรางวัล/เหรียญ: ใช้ `<JKIcon name="award" />`, `<JKIcon name="medal" />`, หรือ `<JKIcon name="trophy" />` แทน 🏆 / 🥇 / 🥈 / 🥉
* ไอคอนภาพถ่าย/กล้อง: ใช้ `<JKIcon name="camera" />` แทน 📸
* ไอคอนดาว/คะแนน: ใช้ `<JKIcon name="star" />` แทน 🌟
* ไอคอนการแชร์: ใช้ `<JKIcon name="share-nodes" />` หรือ Brand Icon แทน
