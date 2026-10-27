# WebSec AI — design reference

Bản xuất từ canvas thiết kế, dùng để đối chiếu khi code.

| Thư mục | Nội dung |
|---|---|
| `index.html` | Trang mục lục, mở trong trình duyệt hoặc VS Code |
| `screens/` | 13 màn dạng HTML tĩnh (trạng thái mặc định, link giữa các màn vẫn bấm được) |
| `screenshots/` | Ảnh PNG 1440px của từng màn, để Claude hoặc bạn so sánh nhanh |
| `source/` | File `.dc.html` gốc: có đủ các trạng thái (lỗi, rỗng, dialog, thư mục mở…) trong `sc-if` và `renderVals()` |
| `source/art/`, `screens/art/` | Ảnh nền sinh bằng thuật toán `createArtJob` của Glass Folder Cards |

## Design tokens

- Nền: `#ECEDF1` + ba lớp `radial-gradient` loang nhẹ (xanh aurora góc trên phải, hồng aurora góc dưới trái, trắng giữa), `background-attachment: fixed`
- Kính sữa: `background: rgba(255,255,255,.62)`; `backdrop-filter: blur(22px) saturate(1.5)`; `border: 1px solid rgba(255,255,255,.8)`; `box-shadow: 0 0 0 .5px rgba(0,0,0,.1), 0 10px 26px -8px rgba(10,12,20,.18)`; `border-radius: 20px` (menu trái 22px)
- Nút chính: `radial-gradient(120% 90% at 50% 0%, #3a3a3f 0%, #121214 55%, #050506 100%)` + inset highlight (như `.gf-key--add`)
- Chữ: `#141416`, phụ `#55555c`; font `ui-sans-serif, system-ui, …`; mono `ui-monospace, …` cho ID, host, meta
- Điểm nhấn dữ liệu: `#EF4A2B`; focus `2px #4c8dff`
- Severity: Critical `#B42318`, High `#C2410C`, Medium `#B7791F`, Low/Info xám; trạng thái dùng nền nhạt + chữ đậm cùng tông

## Gợi ý khi làm việc với Claude trong VS Code

- "Đọc `design/screenshots/W08-Vulns.png` và `design/source/W08-Vulns.dc.html`, dựng trang Vulnerabilities giống thiết kế."
- Các trạng thái khác của một màn nằm trong `source/` (tìm `sc-if` và `data-props`).

## Icon 3D

`art/i3d-*.png`: icon từ [3dicons.co](https://3dicons.co) (bản Premium, giấy phép CC0), đã tách nền trắng. Dùng ở W02 (4 thẻ việc cần làm) và W07 (scan, đang chờ, không có lỗi).
