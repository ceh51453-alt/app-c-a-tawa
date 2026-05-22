# TOÀN BỘ KIẾN THỨC EJS + MVU ZOD CHO SILLYTAVERN

> **Môi trường:** SillyTavern + Extension ST-Prompt-Template + Tavern Helper (酒馆助手) + MVU ZOD
> **Tổng hợp từ:** EJS实战指南_2026_ZOD版.md, MVU_ZOD指南.md, ST-Prompt-template_Detailed_Analysis.md, EJS_SillyTavern_Analysis.md
> **Ngôn ngữ:** Tiếng Việt

---

## MỤC LỤC

**PHẦN I — EJS CƠ BẢN & NÂNG CAO**
1. [EJS là gì?](#1-ejs-là-gì)
2. [Nguyên lý cốt lõi: Gửi prompt động](#2-nguyên-lý-cốt-lõi-gửi-prompt-động)
3. [Cú pháp cơ bản](#3-cú-pháp-cơ-bản)
4. [Điều kiện if / else](#4-điều-kiện-if--else)
5. [Hệ thống biến](#5-hệ-thống-biến)
6. [Thao tác với World Info (Lorebook)](#6-thao-tác-với-world-info-lorebook)
7. [Decorator (Trang trí)](#7-decorator-trang-trí)
8. [Content Injection (Bơm nội dung)](#8-content-injection-bơm-nội-dung)
9. [@INJECT — Tiêm prompt nâng cao](#9-inject--tiêm-prompt-nâng-cao)
10. [injectPrompt — Tiêm prompt theo tag](#10-injectprompt--tiêm-prompt-theo-tag)
11. [activateRegex — Kích hoạt Regex động](#11-activateregex--kích-hoạt-regex-động)
12. [Hệ thống đa giai đoạn nhân vật](#12-hệ-thống-đa-giai-đoạn-nhân-vật)
13. [Hằng số tích hợp sẵn](#13-hằng-số-tích-hợp-sẵn)
14. [Bảng tra cứu nhanh hàm tích hợp](#14-bảng-tra-cứu-nhanh-hàm-tích-hợp)
15. [Debug & Kiểm tra lỗi](#15-debug--kiểm-tra-lỗi)

**PHẦN II — MVU ZOD FRAMEWORK**
16. [Tổng quan hệ thống MVU ZOD](#16-tổng-quan-hệ-thống-mvu-zod)
17. [Bước 1: Thiết kế Zod Schema](#17-bước-1-thiết-kế-zod-schema)
18. [Bước 2: Khởi tạo biến (initvar)](#18-bước-2-khởi-tạo-biến-initvar)
19. [Bước 3: Viết prompt biến (cho AI)](#19-bước-3-viết-prompt-biến-cho-ai)
20. [Bước 4: Cấu hình Regex ẩn UpdateVariable](#20-bước-4-cấu-hình-regex-ẩn-updatevariable)
21. [Bước 5: Tavern Helper Script nâng cao](#21-bước-5-tavern-helper-script-nâng-cao)
22. [Bước 6: Giao diện trạng thái (StatusBar)](#22-bước-6-giao-diện-trạng-thái-statusbar)
23. [Tiền tố đặc biệt cho biến](#23-tiền-tố-đặc-biệt-cho-biến)
24. [Zod 4 — Bảng tra cứu nhanh](#24-zod-4--bảng-tra-cứu-nhanh)

**PHẦN III — QUY TẮC VÀNG & CÂU HỎI THƯỜNG GẶP**
25. [Quy tắc vàng khi viết Card](#25-quy-tắc-vàng-khi-viết-card)
26. [Câu hỏi thường gặp (FAQ)](#26-câu-hỏi-thường-gặp-faq)
27. [Tài nguyên tham khảo](#27-tài-nguyên-tham-khảo)

---

# PHẦN I — EJS CƠ BẢN & NÂNG CAO

---

## 1. EJS là gì?

EJS (Embedded JavaScript) là extension mở rộng cho SillyTavern, cho phép nhúng mã JavaScript trực tiếp vào prompt. Nó chạy được trong:
- **World Info / Lorebook** (nơi sử dụng chính)
- **Preset Prompt** (prompt hệ thống)
- **Character Bio** (mô tả nhân vật)
- **Tin nhắn chat**

### Vòng đời xử lý

```
1. SillyTavern tổng hợp prompt (preset + lorebook + character + chat history)
2. Extension ST-Prompt-Template xử lý tất cả block <% ... %>
3. Prompt "sạch" được gửi đến LLM
4. LLM trả lời → extension xử lý block <% ... %> trong tin nhắn (nếu có)
5. Hiển thị kết quả lên giao diện
```

### Khi làm thẻ (Card)

- **Khi viết/soạn**: TẮT prompt template → để AI thấy mã EJS gốc
- **Khi test/chơi**: BẬT prompt template → AI thấy kết quả đã xử lý

---

## 2. Nguyên lý cốt lõi: Gửi prompt động

Vấn đề của card truyền thống: AI đọc TẤT CẢ thông tin cùng lúc → dễ nhầm lẫn giai đoạn.

**Giải pháp:** Dùng EJS để AI chỉ "nhìn thấy" thông tin phù hợp với trạng thái hiện tại.

```javascript
<%_ if (getvar('stat_data.quan_he.hao_cam', { defaults: 0 }) < 30) { _%>
【Nhân vật hiện tại rất lạnh nhạt, không muốn giao tiếp】
<%_ } else { _%>
【Nhân vật rất thân thiết, nói chuyện thoải mái】
<%_ } _%>
```

AI chỉ nhận được MỘT đoạn mô tả duy nhất → không nhầm lẫn.

---

## 3. Cú pháp cơ bản

### Các loại thẻ EJS

| Thẻ | Chức năng | Ghi chú |
|-----|-----------|---------|
| `<% code %>` | Chạy code | Không xuất nội dung, có thể tạo dòng trắng |
| `<%_ code _%>` | Chạy code (**khuyến nghị**) | Tự động xóa khoảng trắng thừa |
| `<%= expr %>` | Xuất giá trị | HTML escaped (an toàn) |
| `<%- expr %>` | Xuất giá trị nguyên bản | Không escape, xuất HTML thô |
| `<%# comment %>` | Chú thích | Không được xử lý |

**Luôn dùng `<%_ _%>` để tránh dòng trắng thừa.**

### Phân biệt code và văn bản

```javascript
<%_ if (getvar('stat_data.hp') < 30) { _%>
Nhân vật đang bị thương nặng.          ← Văn bản gửi cho AI
<%_ } _%>
```

### Xuất giá trị vào prompt

```javascript
/* Thời gian hiện tại */
<%= new Date(Date.now()).toISOString() %>

/* Số ngẫu nhiên 0~10 */
<%= _.random(0, 10) %>

/* Chọn ngẫu nhiên */
<%= _.sample(['một', 'hai', 'ba']) %>

/* Hiển thị biến dạng YAML */
<%= YAML.stringify(getvar('stat_data'), { blockQuote: 'literal' }) %>

/* Hiển thị biến dạng JSON */
<%= JSON.stringify(getvar('stat_data')) %>
```

---

## 4. Điều kiện if / else

### Cấu trúc cơ bản

```javascript
<%_ if (điều_kiện) { _%>
Nội dung khi điều kiện đúng
<%_ } _%>
```

### if / else

```javascript
<%_ if (điều_kiện) { _%>
Nội dung khi đúng
<%_ } else { _%>
Nội dung khi sai
<%_ } _%>
```

### if / else if / else — Đa giai đoạn

```javascript
<%_ if (getvar('stat_data.quan_he.hao_cam') < 30) { _%>
【Thái độ lạnh nhạt, thậm chí hơi lạnh lùng】
<%_ } else if (getvar('stat_data.quan_he.hao_cam') < 60) { _%>
【Có thiện cảm, nhưng vẫn giữ khoảng cách】
<%_ } else { _%>
【Rất tin tưởng, sẵn sàng chia sẻ bí mật】
<%_ } _%>
```

### So sánh chuỗi

```javascript
<%_ if (getvar('stat_data.su_kien.thoi_tiet') === 'Trời nắng') { _%>
【Hôm nay trời đẹp, thích hợp đi dạo】
<%_ } else if (getvar('stat_data.su_kien.thoi_tiet') === 'Trời mưa') { _%>
【Ngoài trời đang mưa, nhớ mang ô】
<%_ } _%>
```

### Điều kiện nâng cao

```javascript
/* 20% xác suất gửi prompt */
<%_ if (_.random(0, 1, true) < 0.2) { _%>
Nội dung hiếm khi xuất hiện
<%_ } _%>

/* Chỉ gửi sau tầng thứ 5 */
<%_ if (TavernHelper.getLastMessageId() > 5) { _%>
Nội dung xuất hiện muộn
<%_ } _%>

/* Chỉ gửi sau 12h trưa (giờ thực) */
<%_ if ((new Date).getHours() >= 12) { _%>
Nội dung buổi chiều
<%_ } _%>
```

### matchChatMessages — Quét lịch sử chat

```javascript
/* Nếu 2 tin nhắn gần nhất có từ khóa */
<%_ if (matchChatMessages(['chiến đấu', 'tấn công'])) { _%>
Kích hoạt hệ thống chiến đấu
<%_ } _%>

/* Tùy chỉnh số tầng quét */
<%_ if (matchChatMessages(['bẫy', 'nguy hiểm'], { start: -4 })) { _%>
Cảnh báo nguy hiểm
<%_ } _%>

/* Hỗ trợ Regex */
<%_ if (matchChatMessages([/<thinking>.*<\/thinking>/s])) { _%>
Phát hiện khối thinking
<%_ } _%>
```

---

## 5. Hệ thống biến

### Phạm vi biến (Variable Scope)

| Phạm vi | Mô tả | Lưu trữ | Dùng cho |
|---------|--------|---------|----------|
| `global` | Biến toàn cục | ✅ | Dùng chung giữa các nhân vật/chat |
| `local` | Biến chat cục bộ | ✅ | Riêng cho cuộc trò chuyện hiện tại |
| `message` | Biến tin nhắn | ✅ | Gắn vào tin nhắn cụ thể |
| `cache` | Biến tạm | ❌ | Tính toán tạm thời (mặc định) |
| `initial` | Biến khởi tạo | ❌ | Chỉ đọc, từ `[InitialVariables]` |

**Ưu tiên (cao → thấp):** message (mới nhất → cũ nhất) → local → global

### MVU ZOD: Biến nằm dưới `stat_data`

```javascript
/* ✅ Đúng */
const value = getvar('stat_data.nhan_vat.hao_cam', { defaults: 0 });

/* ❌ Sai: thiếu stat_data */
const value = getvar('nhan_vat.hao_cam');

/* ❌ Sai: không cần [0] */
const value = getvar('stat_data.nhan_vat.hao_cam[0]');
```

### getvar() — Đọc biến

```javascript
getvar(key, options)
```

| Tham số | Mô tả |
|---------|-------|
| `key` | Đường dẫn biến (string), `null` = lấy toàn bộ cây biến |
| `options.scope` | Phạm vi: `'global'` / `'local'` / `'message'` / `'cache'` / `'initial'` |
| `options.defaults` | Giá trị mặc định khi biến không tồn tại |
| `options.noCache` | `true` = bỏ qua cache |

```javascript
/* Đọc biến MVU ZOD */
const value = getvar('stat_data.nhan_vat.hao_cam', { defaults: 0 });

/* Chỉ định scope */
const name = getvar('ten_user', { scope: 'local', defaults: 'Không rõ' });

/* Kiểm tra biến có tồn tại không */
getvar('stat_data.nhan_vat.hao_cam') !== undefined
```

Viết tắt: `getLocalVar()`, `getGlobalVar()`, `getMessageVar()`

### setvar() — Ghi biến

```javascript
setvar(key, value, options)
```

| Tham số | Mô tả |
|---------|-------|
| `key` | Tên biến, `null` = thay thế toàn bộ cây |
| `value` | Giá trị mới |
| `options.scope` | Phạm vi (mặc định `'message'`) |
| `options.flags` | Điều kiện ghi |

**Flags:**

| Flag | Mô tả |
|------|-------|
| `n` | Ghi đè trực tiếp (mặc định) |
| `nx` | Chỉ ghi khi biến CHƯA tồn tại (dựa trên cache) |
| `xx` | Chỉ ghi khi biến ĐÃ tồn tại (dựa trên cache) |
| `nxs` | Chỉ ghi khi chưa tồn tại (dựa trên scope chỉ định) |
| `xxs` | Chỉ ghi khi đã tồn tại (dựa trên scope chỉ định) |

```javascript
/* Ghi vào local scope */
setvar('dem', 1, { scope: 'local' });

/* Chỉ ghi khi biến chưa tồn tại */
setvar('da_khoi_tao', true, { scope: 'local', flags: 'nx' });

/* Viết tắt */
setvar('a', 1, 'nx');        // flags
setvar('a', 1, 'global');    // scope
```

Viết tắt: `setLocalVar()`, `setGlobalVar()`, `setMessageVar()`

### incvar() / decvar() — Tăng / Giảm biến

```javascript
/* Hảo cảm +5, giới hạn [0, 100] */
incvar('hao_cam', 5, { scope: 'local', min: 0, max: 100 });

/* Vàng -100, không xuống dưới 0 */
decvar('vang', 100, { scope: 'local', min: 0 });
```

### delvar() — Xóa biến

```javascript
delvar('ten_bien');             // Xóa toàn bộ biến
delvar('ten_bien', 'thuoc_tinh'); // Xóa thuộc tính trong object
delvar('ten_bien', 0);          // Xóa phần tử tại index trong array
```

### insvar() — Chèn phần tử

```javascript
insvar('object_bien', 'gia_tri_moi', 'key_moi');  // Chèn key vào object
insvar('array_bien', 'phan_tu_moi');               // Thêm vào cuối array
insvar('array_bien', 'phan_tu_moi', 2);            // Chèn tại vị trí 2
```

### define() — Định nghĩa biến/hàm toàn cục

```javascript
define('tinh_sat_thuong', function(luc, phong_thu) {
  return Math.max(0, luc - phong_thu);
});
```

> **Lưu ý:** Phải dùng `function` (không dùng arrow function). Truy cập biến qua `this` (ví dụ: `this.getvar`, `this.setvar`).

### JSON Patch

```javascript
/* Áp dụng JSON Patch lên biến */
patchVariables('stat_data', [
  { op: 'replace', path: '/nhan_vat/hao_cam', value: 50 },
  { op: 'add', path: '/nhan_vat/trang_thai_moi', value: 'hạnh phúc' },
]);

/* Hàm cấp thấp: áp dụng lên object bất kỳ */
const result = jsonPatch(doi_tuong_goc, [
  { op: 'replace', path: '/path', value: 'gia_tri_moi' },
]);
```

### parseJSON — Phân tích JSON lỏng lẻo

```javascript
/* Chịu được JSON lỗi format từ LLM */
const obj = parseJSON('{ key: "value", }');  // dấu phẩy thừa vẫn OK
```

---

## 6. Thao tác với World Info (Lorebook)

### getwi() — Đọc nội dung entry

```javascript
await getwi('Tên_Entry')                        // Tự suy luận lorebook
await getwi('Tên_Lorebook', 'Tên_Entry')        // Chỉ định lorebook
await getwi('Tên_Entry', { key: value })         // Truyền dữ liệu
await getwi(/NhanVat_\d+/)                       // Regex khớp tên
await getwi(12345)                               // Dùng UID
```

> **BẮT BUỘC** phải dùng `await`. `<%- getwi('entry') %>` ❌ → `<%- await getwi('entry') %>` ✅

### activewi() — Kích hoạt entry

Kích hoạt entry theo cơ chế greenlight gốc của SillyTavern (tuân thủ từ khóa, vector hóa, nhóm):

```javascript
await activewi('Tên_Entry')                      // Tự suy luận
await activewi('Tên_Entry', true)                // Bắt buộc kích hoạt (bỏ qua keyword)
await activewi('Tên_Lorebook', 'Tên_Entry', true) // Chỉ định lorebook
```

> **Phải** chạy trong entry có `[GENERATE:BEFORE]` hoặc `@@generate_before`, nếu không chỉ có hiệu lực từ lượt generate tiếp theo.

### getchar() — Đọc định nghĩa nhân vật

```javascript
const charDef = await getchar();              // Nhân vật hiện tại
const charDef = await getchar('Tên_Nhân_Vật'); // Chỉ định nhân vật
```

### getpreset() — Đọc preset prompt

```javascript
const prompt = await getpreset('Tên_Preset');
```

### getqr() — Đọc Quick Reply

```javascript
const content = await getqr('Tên_Bộ_QR', 'Tên_Entry');
```

### Dữ liệu thô

```javascript
const charData = await getCharData();                    // Dữ liệu thô nhân vật
const entries = await getWorldInfoData('Tên_Lorebook');  // Toàn bộ entry trong lorebook
const qrData = getQuickReplyData('Tên_Bộ_QR');          // Dữ liệu Quick Reply
const allEntries = await getEnabledWorldInfoEntries();   // Tất cả entry đang kích hoạt
```

---

## 7. Decorator (Trang trí)

Decorator đặt ở **ĐẦU** nội dung entry, mỗi dòng một decorator, KHÔNG có dòng trống giữa các decorator.

### Danh sách decorator

| Decorator | Chức năng |
|-----------|----------|
| `@@activate` | Coi như entry 🔵 kích hoạt vĩnh viễn |
| `@@dont_activate` | Cấm kích hoạt hoàn toàn (kể cả `activewi`) |
| `@@generate_before` | Bơm vào đầu prompt gửi LLM |
| `@@generate_after` | Bơm vào cuối prompt gửi LLM |
| `@@render_before` | Hiển thị ở đầu tin nhắn (KHÔNG gửi LLM) |
| `@@render_after` | Hiển thị ở cuối tin nhắn (KHÔNG gửi LLM) |
| `@@preprocessing` | Chạy TRƯỚC khi SillyTavern xử lý lorebook (dùng cho greenlight động) |
| `@@initial_variables` | Nội dung được coi là biến khởi tạo |
| `@@always_enabled` | Bắt buộc bật entry đặc biệt |
| `@@only_preload` | Chỉ chạy trong giai đoạn preload |
| `@@dont_preload` | Không chạy trong giai đoạn preload |
| `@@private` | Tự bọc `<% { %>` ... `<% } %>` → tránh xung đột biến |
| `@@if điều_kiện` | Loại bỏ entry khi điều kiện sai |
| `@@iframe` | Tạo iframe cô lập CSS |
| `@@message_formatting` | Xuất HTML (chỉ trong RENDER) |

### @@preprocessing — Greenlight động

```javascript
@@preprocessing
<%_ if (getvar('stat_data.su_kien.thoi_tiet') === 'Trời nắng') { _%>
từ_khóa_nắng
<%_ } _%>
```

Sau khi xử lý, nội dung entry trở thành `từ_khóa_nắng` → kích hoạt các entry greenlight liên quan.

> **Yêu cầu:** SillyTavern 1.13.4+. KHÔNG dùng chung với `@@generate_before`/`@@generate_after`.

### @@if — Điều kiện gọn

```
@@if variables.nhan_vat.hao_cam >= 90
Nhân vật rất yêu {{user}}
```

```
@@if variables.nhan_vat.hao_cam > 50 && variables.nhan_vat.hao_cam < 90
Nhân vật coi {{user}} là bạn
```

### @@iframe — Giao diện cô lập

```
@@render_after
@@iframe Trạng thái nhân vật (Click để xem)
@@if !is_user && !is_system
<html>
<head></head>
<body>
<div>
💖 Hảo cảm: <%- getvar('stat_data.quan_he.hao_cam', { defaults: 0 }) %>
</div>
</body>
</html>
```

`@@iframe` + tiêu đề phía sau → tự động thu gọn (collapsible).

---

## 8. Content Injection (Bơm nội dung)

Đặt tiền tố đặc biệt vào **tiêu đề (comment/name)** của entry lorebook:

| Tiền tố | Vị trí bơm | Ghi chú |
|---------|-----------|---------|
| `[GENERATE:BEFORE]` | Đầu prompt gửi LLM | Chỉ 🔵 |
| `[GENERATE:AFTER]` | Cuối prompt gửi LLM | 🔵 và 🟢 |
| `[RENDER:BEFORE]` | Đầu tin nhắn hiển thị | Chỉ render, không gửi LLM |
| `[RENDER:AFTER]` | Cuối tin nhắn hiển thị | Chỉ render, không gửi LLM |
| `[GENERATE:{idx}:BEFORE]` | Trước tin nhắn thứ idx | idx bắt đầu từ 0 |
| `[GENERATE:{idx}:AFTER]` | Sau tin nhắn thứ idx | idx bắt đầu từ 0 |
| `[GENERATE:REGEX:pattern]` | Khi nội dung tin nhắn khớp regex | Regex matching |
| `[InitialVariables]` | Biến khởi tạo | Phải là JSON hợp lệ |

### Regex injection — Biến ngữ cảnh

Khi dùng `[GENERATE:REGEX:pattern]`, các biến sau tự động có sẵn:
- `matched_message` — Nội dung tin nhắn khớp
- `matched_message_index` — Vị trí tin nhắn
- `matched_message_role` — Vai trò (user/assistant)

---

## 9. @INJECT — Tiêm prompt nâng cao

> ⚠️ Entry **PHẢI** ở trạng thái **disabled** mới có hiệu lực.

`@INJECT` tạo tin nhắn **độc lập** (user/assistant/system) tiêm trực tiếp vào prompt, thay vì gộp chung vào khối System.

### Chế độ 1: Vị trí tuyệt đối (pos)

```
@INJECT pos=1,role=system          // Sau tin nhắn đầu tiên
@INJECT pos=-1,role=user           // Vị trí cuối cùng
```

### Chế độ 2: Tin nhắn đích (target)

```
@INJECT target=user,index=1,at=before,role=system     // Trước tin nhắn user đầu tiên
@INJECT target=assistant,index=-1,at=after,role=user   // Sau tin nhắn assistant cuối cùng
```

### Chế độ 3: Regex (regex)

```
@INJECT regex=xin_chào,at=before,role=system        // Trước tin nhắn có "xin_chào"
@INJECT regex="^Người_dùng.*",at=after,role=assistant
```

### Thứ tự ưu tiên

1. Theo vị trí chèn: từ sau ra trước
2. Cùng vị trí: theo thứ tự lorebook
3. Loại: `pos` > `target` > `regex`

### Lưu ý API

| API | Yêu cầu |
|-----|---------|
| ChatGPT | System thường ở đầu, không yêu cầu xen kẽ nghiêm ngặt |
| Gemini | systemInstruction riêng, user/model xen kẽ nghiêm ngặt |
| Claude | user/assistant xen kẽ nghiêm ngặt, system ở bất kỳ đâu |
| Deepseek | Khuyến nghị xen kẽ, tin cuối phải là user |

---

## 10. injectPrompt — Tiêm prompt theo tag

Cho phép định nghĩa đoạn prompt trong lorebook, sau đó import vào preset:

**Trong Lorebook:**
```javascript
<%
injectPrompt("CoT", `
# Hảo cảm
Q: Hảo cảm của <char> hiện tại là bao nhiêu?
Q: Hành động tiếp theo sẽ ảnh hưởng thế nào?
Q: Hảo cảm sau thay đổi là bao nhiêu?
`)
%>
```

**Trong Preset:**
```javascript
Hãy suy nghĩ theo các bước sau:
<thinking>
<%- getPromptsInjected("CoT") %>
</thinking>
```

Các hàm liên quan:
- `injectPrompt(key, prompt, order, sticky, uid)` — Tiêm prompt
- `getPromptsInjected(key, postprocess)` — Đọc prompt đã tiêm
- `hasPromptsInjected(key)` — Kiểm tra có tồn tại không

---

## 11. activateRegex — Kích hoạt Regex động

### Regex SillyTavern (chỉ khi generate)

```javascript
<%
    /* Ẩn nội dung <think> trong output */
    activateRegex(/<think>[\s\S]*?<\/think>/gi, "");
%>
```

### Regex tiền xử lý (generate + render)

```javascript
<%
    /* Tạo macro tùy chỉnh {{getvars::...}} */
    activateRegex(/\{\{getvars::([a-zA-Z0-9_]+?)\}\}/gi, function(match, varName) {
        return this.getvar(varName);
    }, {
        generate: true
    });
%>
```

### Regex HTML tin nhắn

```javascript
<%_
    /* Thay thế link ảnh */
    activateRegex(
        /files\.catbox\.moe/gi,
        'catbox.xxx.net',
        {
            message: true,
            html: true
        }
    );
_%>
```

---

## 12. Hệ thống đa giai đoạn nhân vật

### Cấu trúc thư mục

```
Lorebook/
├── NhanVat_Controller (✅ Đèn xanh vĩnh viễn)
├── NhanVat_GiaiDoan_01   (❌ Disabled)
├── NhanVat_GiaiDoan_02   (❌ Disabled)
├── NhanVat_GiaiDoan_03   (❌ Disabled)
└── ...
```

- **Controller**: Đèn xanh vĩnh viễn, đọc biến và nạp giai đoạn tương ứng
- **Entry giai đoạn**: Disabled, được controller nạp qua `getwi()`

### Mẫu 1: Controller đơn biến

```javascript
<%_
if (typeof goodwill === 'undefined') var goodwill = getvar('stat_data.quan_he.hao_cam', { defaults: 0 });
if (typeof relationship === 'undefined') var relationship = getvar('stat_data.quan_he.trang_thai', { defaults: 'Xa lạ' });
_%>

<%_ if (goodwill < 26) { _%>
<%- await getwi('NhanVat_GiaiDoan01_TiepXuc') %>
<%_ } else if (goodwill < 51) { _%>
<%- await getwi('NhanVat_GiaiDoan02_AmMuoi') %>
<%_ } else if (goodwill < 76) { _%>
<%- await getwi('NhanVat_GiaiDoan03_ToTinh') %>
<%_ } else if (relationship === 'Người yêu') { _%>
<%- await getwi('NhanVat_GiaiDoan04_LuyenAi') %>
<%_ } else { _%>
<%- await getwi('NhanVat_GiaiDoan03_ToTinh') %>
<%_ } _%>
```

### Mẫu 2: @@preprocessing kích hoạt greenlight

```javascript
@@preprocessing
<%_
if (typeof currentDate === 'undefined') var currentDate = getvar('stat_data.the_gioi.ngay_hien_tai', { defaults: '' });
_%>

<%_ if (currentDate.includes('25 tháng 10') || currentDate.includes('27 tháng 10')) { _%>
le_hoi_truong_hoc
<%_ } else if (currentDate.includes('24 tháng 12') || currentDate.includes('25 tháng 12')) { _%>
le_giang_sinh
<%_ } _%>
```

### Mẫu 3: Pure code + print

```javascript
<%_
if (typeof value === 'undefined') var value = getvar('stat_data.nhan_vat.thuoc_tinh', { defaults: 0 });

if (value > 50) {
  print(await getwi('Entry_Dac_Biet'));
}
_%>
```

### Cấu hình entry

| Loại entry | Kích hoạt | Thứ tự |
|-----------|---------|--------|
| Controller (có getwi/activewi) | Đèn xanh vĩnh viễn | 100 |
| Entry giai đoạn (được nạp) | Disabled | 98~800 |
| Preprocessing controller | Đèn xanh vĩnh viễn | 100 |
| Entry greenlight | Đèn xanh | Tùy nhu cầu |

### Chống xung đột biến — `typeof` check

```javascript
/* ✅ Khuyến nghị */
if (typeof xialiAo === 'undefined') var xialiAo = getvar('stat_data.tsundere.ao', { defaults: 100 });

/* ✅ Dùng tiền tố tên nhân vật để tránh trùng */
if (typeof xialiRelation === 'undefined') var xialiRelation = getvar('stat_data.the_gioi.quan_he', { defaults: 'Bạn học' });
```

Hoặc dùng decorator `@@private` để tự động bọc scope.

---

## 13. Hằng số tích hợp sẵn

### Luôn có sẵn

```javascript
variables         // Tất cả biến đã merge
SillyTavern       // SillyTavern.getContext()
faker             // Thư viện Faker (faker.fakerEN, faker.fakerCN)
_                 // Lodash
$                 // jQuery
toastr            // Thư viện thông báo
runType           // 'generate' | 'preparation' | 'render' | 'render_permanent'
charLoreBook      // Tên lorebook nhân vật
userLoreBook      // Tên lorebook user
chatLoreBook      // Tên lorebook chat
userName          // Tên user
charName          // Tên nhân vật
chatId            // ID phiên chat
characterId       // ID nhân vật
groupId           // ID nhóm chat (null nếu không phải nhóm)
charAvatar        // URL avatar nhân vật
userAvatar        // URL avatar user
lastUserMessageId // ID tin nhắn user mới nhất
lastCharMessageId // ID tin nhắn nhân vật mới nhất
lastUserMessage   // Nội dung tin nhắn user cuối
lastCharMessage   // Nội dung tin nhắn nhân vật cuối
lastMessageId     // ID tin nhắn cuối
model             // Model đang dùng
generateType      // '' | 'normal' | 'continue' | 'regenerate' | 'swipe' | 'quiet'...
```

### Chỉ có khi render (runType === 'render')

```javascript
message_id        // Số tầng tin nhắn
swipe_id          // ID trang swipe
name              // Tên vai trò của tin nhắn
is_last           // Có phải tin nhắn cuối không
is_user           // Có phải tin nhắn user không
is_system         // Có phải tin nhắn hệ thống không
```

### Chỉ có khi generate

```javascript
world_info        // Object entry lorebook đang xử lý
generateBuffer    // Nội dung đã xử lý phía trên
generateData      // Nội dung generate chưa qua template
```

---

## 14. Bảng tra cứu nhanh hàm tích hợp

### Biến số

```javascript
getvar(key, options)                        // Đọc biến
setvar(key, value, options)                 // Ghi biến
incvar(key, value, options)                 // Tăng biến
decvar(key, value, options)                 // Giảm biến
delvar(key, index, options)                 // Xóa biến
insvar(key, value, index, options)          // Chèn phần tử
define(name, value, merge)                  // Định nghĩa toàn cục
patchVariables(key, changes, options)       // JSON Patch
```

### World Info

```javascript
await getwi(title, data)                            // Đọc entry
await getwi(lorebook, title, data)
await activewi(title, force)                        // Kích hoạt entry
await activewi(lorebook, title, force)
await activateWorldInfoByKeywords(keywords)          // Kích hoạt qua keyword
await getEnabledWorldInfoEntries()                   // Lấy tất cả entry đang bật
```

### Nhân vật / Preset / Quick Reply

```javascript
await getchar(name, template, data)        // Đọc nhân vật
await getCharData(name)                    // Dữ liệu thô nhân vật
await getpreset(name, data)                // Đọc preset
await getqr(name, label, data)             // Đọc Quick Reply
```

### Chat

```javascript
getChatMessage(idx, role)                  // Lấy tin nhắn cụ thể
getChatMessages(count)                     // Lấy N tin nhắn
getChatMessages(start, end, role)          // Lấy khoảng tin nhắn
matchChatMessages(pattern, options)        // Tìm kiếm tin nhắn
```

### Xuất & Tiêm

```javascript
print(...args)                                      // Xuất văn bản
injectPrompt(key, prompt, order, sticky, uid)       // Tiêm prompt
getPromptsInjected(key, postprocess)                // Đọc prompt đã tiêm
hasPromptsInjected(key)                             // Kiểm tra tồn tại
```

### Regex & Template

```javascript
activateRegex(pattern, replace, opts)               // Kích hoạt regex
await evalTemplate(content, data, options)           // Xử lý template
await getSyntaxErrorInfo(code, max_lines)            // Kiểm tra lỗi cú pháp
```

### Tiện ích

```javascript
parseJSON(text)                            // Phân tích JSON lỏng lẻo
jsonPatch(dest, changes)                   // JSON Patch cấp thấp
await execute(cmd)                         // Chạy lệnh SillyTavern
```

---

## 15. Debug & Kiểm tra lỗi

### Prompt Viewer

`Thanh nhập liệu → Cây đũa phép (góc trái dưới) → Prompt Viewer` → xem prompt thực tế đã gửi cho AI.

### alert()

```javascript
<%_
if (getvar('stat_data.su_kien.thoi_tiet') === 'Trời nắng') {
  alert('Đã kích hoạt prompt trời nắng');
} else {
  alert(`Không kích hoạt. Giá trị: ${getvar('stat_data.su_kien.thoi_tiet')}`);
}
_%>
```

### toastr

```javascript
<%_
toastr.info('Thông tin');
toastr.success('Thành công');
toastr.warning('Cảnh báo');
toastr.error('Lỗi');
_%>
```

### console

```javascript
<%_
const value = getvar('stat_data.nhan_vat.thuoc_tinh', { defaults: 0 });
console.log('Log:', value);
console.info('Info:', value);     // Xanh
console.warn('Warn:', value);     // Vàng
console.error('Error:', value);   // Đỏ
_%>
```

Nhấn `F12` → tab Console để xem.

### debugger

```javascript
<%_ debugger; _%>
```

Mở F12 trước → code sẽ dừng tại `debugger;` → kiểm tra tất cả biến.

### Escape EJS

```html
<%= 'dòng 1' %>
<#escape-ejs>
<%= 'dòng 2' %>    <!-- Không chạy, xuất nguyên bản -->
<#/escape-ejs>
<%= 'dòng 3' %>
```

---

# PHẦN II — MVU ZOD FRAMEWORK

---

## 16. Tổng quan hệ thống MVU ZOD

MVU ZOD là framework quản lý biến cho SillyTavern. Cấu trúc:

```
Thẻ nhân vật/
├── Zod Schema (Script)        ← Định nghĩa kiểu dữ liệu & ràng buộc
├── [initvar] Biến khởi tạo    ← YAML, giá trị ban đầu (entry disabled)
├── Danh sách biến             ← Cho AI thấy giá trị hiện tại
├── [mvu_update] Quy tắc cập nhật  ← Hướng dẫn AI khi nào cập nhật
├── [mvu_update] Định dạng xuất    ← Hướng dẫn AI format output
├── Regex SillyTavern          ← Ẩn <UpdateVariable>, format UI
├── Tavern Helper Script (tùy chọn) ← Lắng nghe event, can thiệp biến
└── Giao diện (tùy chọn)      ← StatusBar qua <StatusPlaceHolderImpl/>
```

### Luồng xử lý

1. **Zod Schema** định nghĩa biến nên có dạng gì
2. **initvar** thiết lập giá trị ban đầu
3. **Danh sách biến** cho AI đọc giá trị hiện tại
4. **Quy tắc cập nhật** cho AI biết khi nào cần cập nhật
5. **Định dạng xuất** cho AI biết dùng JSON Patch format
6. MVU giải mã lệnh cập nhật trong output AI → cập nhật biến
7. Zod Schema kiểm tra & sửa giá trị sau cập nhật

---

## 17. Bước 1: Thiết kế Zod Schema

### Template cố định (đầu + cuối)

```javascript
import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

export const Schema = z.object({
  // Định nghĩa biến ở đây
});

$(() => {
  registerMvuSchema(Schema);
});
```

> **QUAN TRỌNG:** `z` (Zod 4) và `_` (Lodash) đã có sẵn toàn cục. **KHÔNG import** chúng.

### Ví dụ đầy đủ

```javascript
import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

export const Schema = z.object({
  the_gioi: z.object({
    thoi_gian: z.string(),
    dia_diem: z.string(),
    su_vu: z.record(z.string().describe('Tên sự vụ'), z.string().describe('Mô tả')),
  }),

  nhan_vat: z.object({
    hao_cam: z.coerce.number().transform(v => _.clamp(v, 0, 100)),
    trang_phuc: z.record(
      z.enum(['Áo', 'Quần', 'Giày', 'Phụ kiện']),
      z.string().describe('Mô tả trang phục')
    ),
    danh_hieu: z.record(
      z.string().describe('Tên danh hiệu'),
      z.object({
        hieu_ung: z.string(),
        tu_danh_gia: z.string().prefault('Chưa đánh giá'),
      }),
    ),
  }).transform(data => {
    // Giới hạn số danh hiệu dựa vào hảo cảm
    data.danh_hieu = _(data.danh_hieu)
      .entries()
      .takeRight(Math.ceil(data.hao_cam / 10))
      .fromPairs()
      .value();
    return data;
  }),

  chu_nhan: z.object({
    tui_do: z.record(
      z.string().describe('Tên vật phẩm'),
      z.object({
        mo_ta: z.string(),
        so_luong: z.coerce.number().prefault(1),
      }),
    ).transform(data => _.pickBy(data, ({ so_luong }) => so_luong > 0)),
  }),
});

$(() => {
  registerMvuSchema(Schema);
});
```

**Schema này thực hiện:**
- Hảo cảm giới hạn 0~100
- Tự đánh giá mặc định "Chưa đánh giá"
- Số danh hiệu tỷ lệ với hảo cảm
- Vật phẩm số lượng ≤ 0 tự xóa
- Số lượng mặc định = 1

### Nơi lưu

Tavern Helper Script →角色脚本 (Character Script) → Tên chứa "变量结构" (Cấu trúc biến).

---

## 18. Bước 2: Khởi tạo biến (initvar)

### YAML format

```yaml
the_gioi:
  thoi_gian: 2024-04-08 10:45
  dia_diem: Trường học Phong Tế, Lớp 2A
  su_vu:
    chuyen_truong: Nhân vật mới chuyển đến, cần nhận sách
    gio_nghi_trua: Sắp đến giờ nghỉ trưa

nhan_vat:
  hao_cam: 35
  trang_phuc:
    Áo: Áo đồng phục xanh đậm, cài cúc chỉnh tề
    Quần: Váy xếp ly xanh đậm dài đến đầu gối
    Giày: Giày da đen học sinh, đánh bóng sáng
    Phụ kiện: Không
  danh_hieu:
    Người_mơ_đi:
      hieu_ung: Hành động mang cảm giác mệt mỏi rõ rệt
      tu_danh_gia: Sống bản thân đã là hình phạt

chu_nhan:
  tui_do:
    Bang_keo_ca:
      mo_ta: Miếng băng keo hình con mèo đã cũ trong ví
      so_luong: 1
    Keo_bac_ha:
      mo_ta: Kẹo bạc hà tỉnh táo, vị rất mạnh
      so_luong: 1
```

### Cấu hình entry

- **Tên entry:** `[initvar]Khởi_Tạo_Biến_Không_Mở`
- **Trạng thái:** **BẮT BUỘC disabled** — MVU chỉ đọc entry initvar đang disabled

### Khởi tạo theo mỗi mở đầu (Opening)

**Cách 1: Toàn bộ (Full override)**

Trong tin nhắn mở đầu:
```
<UpdateVariable>
<initvar>
the_gioi:
  thoi_gian: ...
  dia_diem: ...
nhan_vat:
  hao_cam: 15
  ...
</initvar>
</UpdateVariable>
```

Nếu có `<initvar>` trong mở đầu → **bỏ qua hoàn toàn** entry `[initvar]` trong lorebook.

**Cách 2: Tăng dần (JSON Patch)**

```
<UpdateVariable>
<JSONPatch>
[
  { "op": "replace", "path": "/nhan_vat/su_kien_dac_biet", "value": true }
]
</JSONPatch>
</UpdateVariable>
```

Đầu tiên dùng `[initvar]` khởi tạo, sau đó áp dụng patch từ mở đầu.

---

## 19. Bước 3: Viết prompt biến (cho AI)

### 3.1 Danh sách biến — Cho AI thấy giá trị hiện tại

**Nội dung (copy nguyên):**

```yaml
---
<status_current_variable>
{{format_message_variable::stat_data}}
</status_current_variable>
```

**Cấu hình entry:**
- **Tên:** `Danh_Sach_Bien` (**KHÔNG** thêm `[mvu_update]`)
- **Vị trí:** D⚙ Depth 0 hoặc 1
- **Thứ tự:** 200

> Đặt ở D0/D1 để danh sách biến luôn tương ứng với diễn biến mới nhất.

**Hiển thị chọn lọc:**

```yaml
---
<status_current_variable>
the_gioi:
  {{format_message_variable::stat_data.the_gioi}}
nhan_vat:
  hao_cam: {{format_message_variable::stat_data.nhan_vat.hao_cam}}
  trang_phuc:
    {{format_message_variable::stat_data.nhan_vat.trang_phuc}}
</status_current_variable>
```

### 3.2 Quy tắc cập nhật — Cho AI biết khi nào cập nhật

```yaml
---
Quy tắc cập nhật biến:
  the_gioi:
    thoi_gian:
      format: YYYY năm MM tháng DD ngày Thứ_X HH:MM
    su_vu:
      type: |-
        {
          [tên_sự_vụ: string]: string; // mô tả sự vụ
        }
      check:
        - Ghi nhận nhiệm vụ, cuộc hẹn, sự kiện quan trọng
        - Hoàn thành thì xóa, phát sinh thì thêm
        - Tối đa 5~8 sự vụ
  nhan_vat:
    hao_cam:
      type: number
      range: 0~100
      check:
        - Tăng/giảm ±(3~6) dựa trên phản ứng của nhân vật
        - Chỉ cập nhật khi nhân vật nhận biết hành vi của user
    trang_phuc.${Áo|Quần|Giày|Phụ kiện}:
      check:
        - Cập nhật khi thay đồ, hư hại, dịp đặc biệt
        - Mô tả cần có màu sắc, chất liệu, kiểu dáng
  chu_nhan:
    tui_do:
      type: |-
        {
          [tên_vật_phẩm: string]: {
            mo_ta: string;
            so_luong?: number;  // mặc định 1
          }
        }
      check:
        - Cập nhật khi nhận, dùng, mất vật phẩm
        - Số lượng = 0 thì tự mất
```

**Các trường:**

| Trường | Ý nghĩa |
|--------|---------|
| `type` | Kiểu dữ liệu (number, TypeScript type). String có thể bỏ qua |
| `range` | Phạm vi số (VD: `0~100`) |
| `format` | Định dạng yêu cầu (VD: format thời gian) |
| `check` | **Quan trọng nhất** — Các yếu tố AI cần xem xét khi cập nhật |

**Cấu hình entry:**
- **Tên:** `[mvu_update]Quy_Tac_Cap_Nhat` (**BẮT BUỘC** có `[mvu_update]`)
- **Vị trí:** D⚙ Depth 0 (hoặc D3/D4)
- **Thứ tự:** 200

### 3.3 Định dạng xuất — Cho AI biết format output

**Nội dung (copy nguyên — bản tiếng Anh, hiệu quả nhất):**

```yaml
---
Định dạng xuất biến:
  rule:
    - you must output the update analysis and the actual update commands at once in the end of the next reply
    - the update commands works like the **JSON Patch (RFC 6902)** standard, must be a valid JSON array containing operation objects, but supports the following operations instead:
      - replace: replace the value of existing paths
      - delta: update the value of existing number paths by a delta value
      - insert: insert new items into an object or array (using `-` as array index intends appending to the end)
      - remove
      - move
    - don't update field names starts with `_` as they are readonly, such as `_biến`
  format: |-
    <UpdateVariable>
    <Analysis>$(IN ENGLISH, no more than 80 words)
    - ${calculate time passed: ...}
    - ${decide whether dramatic updates are allowed as it's in a special case or the time passed is more than usual: yes/no}
    - ${analyze every variable based on its corresponding `check`, according only to current reply instead of previous plots: ...}
    </Analysis>
    <JSONPatch>
    [
      { "op": "replace", "path": "${/path/to/variable}", "value": "${new_value}" },
      { "op": "delta", "path": "${/path/to/number/variable}", "value": "${positive_or_negative_delta}" },
      { "op": "insert", "path": "${/path/to/object/new_key}", "value": "${new_value}" },
      { "op": "insert", "path": "${/path/to/array/-}", "value": "${new_value}" },
      { "op": "remove", "path": "${/path/to/object/key}" },
      { "op": "remove", "path": "${/path/to/array/0}" },
      { "op": "move", "from": "${/path/to/variable}", "to": "${/path/to/another/path}" },
      ...
    ]
    </JSONPatch>
    </UpdateVariable>
```

### Giải thích JSON Patch

| Thao tác | Mô tả | Ví dụ path |
|----------|-------|-----------|
| `replace` | Thay thế giá trị đã có | `/nhan_vat/hao_cam` |
| `delta` | Tăng/giảm số (dương tăng, âm giảm) | `/nhan_vat/hao_cam` |
| `insert` | Thêm key mới vào object, hoặc append vào array (`-`) | `/chu_nhan/tui_do/Kiem_Moi` |
| `remove` | Xóa path | `/chu_nhan/tui_do/Keo_bac_ha` |
| `move` | Di chuyển path | `from: /a`, `to: /b` |

> **Quy tắc path:** Dùng `/` phân tách, bắt đầu từ gốc biến. **KHÔNG có** `stat_data` trong path.

### `<Analysis>` — Tư duy chuỗi (CoT)

`<Analysis>` là CoT chuyên dụng cho cập nhật biến:
1. Tính thời gian đã trôi qua
2. Xác định có cho phép thay đổi mạnh không
3. Rà soát từng biến theo `check` tương ứng → "nhắc nhở" AI về quy tắc cập nhật

**Cấu hình entry:**
- **Tên:** `[mvu_update]Dinh_Dang_Xuat` (**BẮT BUỘC** có `[mvu_update]`)
- **Vị trí:** D⚙ Depth 0 (Gemini) hoặc 4 (Claude)
- **Thứ tự:** 200

### 3.4 Nhấn mạnh (tùy chọn — khi AI hay quên)

```yaml
---
Nhấn mạnh định dạng:
  rule: The following must be inserted to the end of reply, and cannot be omitted
  format: |-
    <UpdateVariable>
    ...
    </UpdateVariable>
```

---

## 20. Bước 4: Cấu hình Regex ẩn UpdateVariable

AI đã xuất `<UpdateVariable>` → MVU đã xử lý → KHÔNG cần gửi lại cho AI (tốn token, AI dễ copy lại).

### 3 Regex cần import

1. **`[Không gửi] Ẩn cập nhật biến`** — Xóa `<UpdateVariable>` khỏi prompt gửi AI
2. **`[Làm đẹp] Đang cập nhật`** / **`[Thu gọn] Đang cập nhật`** — Format hiển thị UI
3. **`[Làm đẹp] Cập nhật hoàn chỉnh`** / **`[Thu gọn] Cập nhật hoàn chỉnh`**

### Giữ lại vài tầng cuối (tùy chọn)

Nếu AI hay cập nhật trùng, đặt **min depth = 4** cho regex "Ẩn cập nhật biến" → chỉ ẩn từ tầng thứ 5 trở lên.

---

## 21. Bước 5: Tavern Helper Script nâng cao

### Mở đầu bắt buộc

```javascript
await waitGlobalInitialized('Mvu');
```

### Lắng nghe COMMAND_PARSED (trước khi áp dụng lệnh)

```javascript
await waitGlobalInitialized('Mvu');
eventOn(Mvu.events.COMMAND_PARSED, commands => {
  commands.forEach(command => {
    // Sửa lệnh trước khi áp dụng
    command.args[0] = command.args[0].replaceAll('-', '');
  });
});
```

### Lắng nghe VARIABLE_UPDATE_ENDED (sau khi cập nhật xong)

```javascript
await waitGlobalInitialized('Mvu');

/* So sánh trước/sau */
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (new_variables, old_variables) => {
  toastr.info(`Trước: ${_.get(old_variables, 'stat_data.nhan_vat.hao_cam')}`);
  toastr.info(`Sau: ${_.get(new_variables, 'stat_data.nhan_vat.hao_cam')}`);
});

/* Giới hạn biên độ thay đổi tối đa 3 */
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (new_variables, old_variables) => {
  const old_value = _.get(old_variables, 'stat_data.nhan_vat.hao_cam');
  _.update(new_variables, 'stat_data.nhan_vat.hao_cam', value => _.clamp(value, old_value - 3, old_value + 3));
});

/* Phát hiện ngưỡng: hảo cảm vượt 30 */
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (new_variables, old_variables) => {
  const old_v = _.get(old_variables, 'stat_data.nhan_vat.hao_cam');
  const new_v = _.get(new_variables, 'stat_data.nhan_vat.hao_cam');
  if (old_v < 30 && new_v >= 30) {
    toastr.success('Hảo cảm đã vượt mốc 30!');
  }
});

/* Khóa biến: không cho AI thay đổi */
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (new_variables, old_variables) => {
  _.set(new_variables, 'stat_data.nhan_vat.hao_cam', _.get(old_variables, 'stat_data.nhan_vat.hao_cam'));
});

/* Xóa biến nhân vật khi chết */
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, variables => {
  if (_.get(variables, 'stat_data.nhan_vat.da_chet') === true) {
    _.unset(variables, 'stat_data.nhan_vat');
  }
});
```

### Đọc/ghi biến MVU trong code

```javascript
await waitGlobalInitialized('Mvu');

/* Đọc biến tầng cuối */
const variables = Mvu.getMvuData({ type: 'message', message_id: -1 });

/* Đọc biến tầng hiện tại (trong giao diện) */
const variables2 = Mvu.getMvuData({ type: 'message', message_id: getCurrentMessageId() });

/* Sửa biến và ghi lại */
_.update(variables2, 'stat_data.nhan_vat.hao_cam', value => value + 5);
await Mvu.replaceMvuData(variables2, { type: 'message', message_id: getCurrentMessageId() });
```

### Dùng biến kích hoạt greenlight

```javascript
await waitGlobalInitialized('Mvu');
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, variables => {
  const value = _.get(variables, 'stat_data.nhan_vat.hao_cam');

  let content = 'giai_doan_nhan_vat';
  if (value < 20) content += '_mot';
  else if (value < 40) content += '_hai';
  else if (value < 60) content += '_ba';
  else content += '_bon';

  injectPrompts([{
    id: 'kich_hoat_hao_cam',
    content,
    position: 'none',
    depth: 0,
    role: 'user',
    should_scan: true,
  }]);
});
```

---

## 22. Bước 6: Giao diện trạng thái (StatusBar)

MVU tự động thêm `<StatusPlaceHolderImpl/>` sau mỗi output AI. Dùng 2 regex để biến nó thành giao diện:

### Regex 1: Không gửi cho AI

```
Tên: [Không gửi] Ẩn StatusBar
Regex: <StatusPlaceHolderImpl/>
Thay bằng: (trống)
Phạm vi: AI Output
Tạm: Chỉ format prompt ✅
```

### Regex 2: Hiển thị giao diện

```
Tên: [Giao diện] Thanh trạng thái
Regex: <StatusPlaceHolderImpl/>
Thay bằng: (code giao diện của bạn)
Phạm vi: AI Output
Tạm: Chỉ format hiển thị ✅
```

**Kết quả:** AI không thấy gì (không tốn token), người chơi thấy giao diện.

### Ví dụ giao diện đơn giản

```html
<style>
.status-bar {
  font-size: 14px;
  color: #ff69b4;
  border: 1px solid #ff69b4;
  padding: 5px;
  border-radius: 8px;
}
</style>
<div class="status-bar">
💖 Hảo cảm: {{format_message_variable::stat_data.nhan_vat.hao_cam}}
</div>
```

### Giao diện tương tác (nâng cao)

```html
<head>
  <style>body { margin: 0; padding: 0; }</style>
  <script type="module">
    function populateData() {
      const all_variables = getAllVariables();
      const value = _.get(all_variables, 'stat_data.nhan_vat.hao_cam', 'N/A');
      $('#dependency-value').text(value);
    }

    async function init() {
      await waitGlobalInitialized('Mvu');
      populateData();
      eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => {
        populateData();
      });
    }

    $(errorCatched(init));
  </script>
</head>
<body>
  <div class="status-bar">
    💖 Hảo cảm: <span id="dependency-value">--</span>
  </div>
</body>
```

---

## 23. Tiền tố đặc biệt cho biến

| Tiền tố | AI nhìn thấy | AI cập nhật được | Dùng cho |
|---------|--------------|-----------------|----------|
| (không) | ✅ | ✅ | Biến thông thường |
| `_` | ✅ | ❌ | Thiết lập cố định (tên, loại thế giới...) |
| `$` | ❌ | ✅ (cần prompt dẫn dắt) | Biến ẩn, flag, chỉ dùng cho EJS/script |

```yaml
the_gioi:
  _loai: Ma thuật    # AI thấy nhưng không sửa được
  $flag_dac_biet: true # AI không thấy, chỉ code dùng
```

---

## 24. Zod 4 — Bảng tra cứu nhanh

### Kiểu cơ bản

```javascript
z.string()              // Chuỗi
z.coerce.number()       // Số (khuyến nghị, tự ép kiểu)
z.boolean()             // Boolean (KHÔNG dùng z.coerce.boolean())
z.literal('giá_trị')    // Giá trị cố định
```

### Kiểu object

```javascript
/* Key cố định bắt buộc + kiểu khác nhau */
z.object({
  hao_cam: z.coerce.number(),
  ten: z.string(),
})

/* Key cố định bắt buộc + kiểu giống nhau (enum key) */
z.record(z.enum(['Lực', 'Thủ', 'Tốc']), z.coerce.number())

/* Key cố định tùy chọn + kiểu giống nhau */
z.partialRecord(z.enum(['Kiếm', 'Khiên', 'Gậy']), z.string())

/* Key động tùy chọn + kiểu giống nhau (túi đồ, thành tựu...) */
z.record(z.string().describe('Tên vật phẩm'), z.object({
  mo_ta: z.string(),
  so_luong: z.coerce.number(),
}))
```

### Ràng buộc & Biến đổi

```javascript
/* Giới hạn số (dùng transform, KHÔNG dùng min/max) */
z.coerce.number().transform(v => _.clamp(v, 0, 100))

/* Giá trị mặc định (dùng prefault, KHÔNG dùng default) */
z.coerce.number().prefault(0)
z.string().prefault('Chưa khởi tạo')

/* Object mặc định — TẤT CẢ field con cũng cần prefault */
z.object({
  hao_cam: z.coerce.number().prefault(0),
  ten: z.string().prefault('Không rõ'),
}).prefault({})

/* Giới hạn số key (giữ 10 mới nhất) */
z.record(z.string(), z.string())
  .transform(data => _(data).entries().takeRight(10).fromPairs().value())

/* Lọc bỏ vật phẩm hết số lượng */
z.record(z.string().describe('Tên vật phẩm'), z.object({
  mo_ta: z.string(),
  so_luong: z.coerce.number(),
})).transform(data => _.pickBy(data, ({ so_luong }) => so_luong > 0))
```

### Bảng quy tắc Zod 4

| Quy tắc | Giải thích |
|---------|-----------|
| Ưu tiên `z.coerce.number()` | Tự ép kiểu, an toàn hơn `z.number()` |
| KHÔNG dùng `z.coerce.boolean()` | Dùng `z.boolean()` trực tiếp |
| Ưu tiên object thay array | `z.record()` dễ bảo trì hơn `z.array()` |
| Dùng `z.transform` để ràng buộc | Giá trị được SỬA chứ không bị LOẠI BỎ |
| Dùng `z.prefault` thay `z.default` | MVU ZOD khuyến nghị |
| `z.transform` chỉ nhận 1 tham số | `(value) => ...` ✅, `(value, ctx) => ...` ❌ |
| KHÔNG dùng `.strict()` / `.passthrough()` | Chúng không tồn tại |
| KHÔNG import `z` hoặc `_` | Đã có sẵn toàn cục |
| Đảm bảo tính lũy đẳng | `Schema.parse(Schema.parse(x))` = `Schema.parse(x)` |

---

# PHẦN III — QUY TẮC VÀNG & CÂU HỎI THƯỜNG GẶP

---

## 25. Quy tắc vàng khi viết Card

### EJS

1. **Luôn dùng `await`** cho hàm bất đồng bộ: `getwi`, `getchar`, `getpreset`, `activewi`, `evalTemplate`, `execute`
2. **Luôn kiểm tra `typeof`** trước khi khai báo biến `var` → tránh xung đột giữa các entry
3. **Đường dẫn biến EJS** có `stat_data.`: `getvar('stat_data.nhan_vat.hao_cam')`
4. **Đường dẫn JSON Patch** KHÔNG có `stat_data`: `"/nhan_vat/hao_cam"`
5. **Decorator phải ở đầu entry**, không có dòng trống giữa các decorator
6. **Dùng `@@private`** khi entry có nhiều biến cục bộ → tránh xung đột

### MVU ZOD

1. **KHÔNG import `z` hay `_`** — chúng đã có sẵn toàn cục
2. **Chỉ import `registerMvuSchema`** — đó là thứ duy nhất cần import
3. **Entry `[initvar]` PHẢI disabled** — MVU chỉ đọc entry initvar đang tắt
4. **Entry `[mvu_update]` PHẢI có prefix** — để tách biệt AI plot vs AI update
5. **Danh sách biến KHÔNG có prefix `[mvu_update]`**
6. **Biến `_` prefix = chỉ đọc, `$` prefix = ẩn khỏi AI**

### Tổng hợp prefix entry

| Entry | Prefix |
|-------|--------|
| Quy tắc cập nhật biến | `[mvu_update]` ✅ |
| Định dạng xuất biến | `[mvu_update]` ✅ |
| Nhấn mạnh định dạng | `[mvu_update]` ✅ |
| Danh sách biến | KHÔNG có ❌ |
| Biến khởi tạo | `[initvar]` |

---

## 26. Câu hỏi thường gặp (FAQ)

### Q1: Đường dẫn biến viết thế nào?

| Ngữ cảnh | Viết |
|----------|------|
| EJS / StatusBar | `getvar('stat_data.nhan_vat.hao_cam')` |
| Macro SillyTavern | `{{format_message_variable::stat_data.nhan_vat.hao_cam}}` |
| JSON Patch (AI output) | `/nhan_vat/hao_cam` (KHÔNG có `stat_data`) |

### Q2: `getwi` bắt buộc `await`?

Đúng. `<%- getwi('entry') %>` ❌ → `<%- await getwi('entry') %>` ✅

### Q3: Khai báo biến trùng lặp?

```javascript
/* ✅ typeof check + var */
if (typeof value === 'undefined') var value = getvar('stat_data.nhan_vat.thuoc_tinh', { defaults: 0 });
```

Hoặc dùng `@@private`.

### Q4: `@@preprocessing` dùng chung decorator khác?

- `@@preprocessing` + `@@generate_before/after`: **KHÔNG** — preprocessing sẽ bị bỏ qua
- `@@generate_before` + `@@generate_after`: **ĐƯỢC** — dùng chung OK

### Q5: Entry không chạy?

1. Controller phải **BẬT** (đèn xanh vĩnh viễn)
2. Kiểm tra keyword / cách kích hoạt
3. Decorator đúng format (không có dòng trống giữa các decorator)
4. Thêm `<%_ console.info('Entry đã chạy'); _%>` để debug

### Q6: Render vs Generate khác gì?

| | Generate | Render |
|--|---------|--------|
| Khi nào | Gửi prompt cho LLM | Hiển thị tin nhắn lên UI |
| `<%= %>` | Xuất giá trị (escaped) | Format hiển thị |
| `<%- %>` | Xuất HTML thô | Xuất HTML thô |
| Sửa nội dung gốc | Thay thế trực tiếp | KHÔNG sửa gốc, chỉ sửa HTML hiển thị |

### Q7: Escape EJS thế nào?

```html
<#escape-ejs>
<%= 'nội dung này không được chạy' %>
<#/escape-ejs>
```

### Q8: Làm sao cho nhân vật mới thêm giữa chừng có giá trị mặc định?

Trong Zod Schema, dùng `.prefault('Chưa khởi tạo')` cho tất cả field → AI thiếu field nào cũng không lỗi, lượt sau sẽ bổ sung.

### Q9: Biến cấu trúc đặt ở đâu?

Tavern Helper Script → Character Script → Tên entry chứa "变量结构" (Cấu trúc biến).

---

## 27. Tài nguyên tham khảo

- **EJS chính thức:** https://ejs.co/
- **ST-Prompt-Template GitHub:** https://github.com/zonde306/ST-Prompt-Template/blob/main/README_CN.md
- **ST-Prompt-Template API:** https://github.com/zonde306/ST-Prompt-Template/blob/main/docs/reference_cn.md
- **Tavern Helper (酒馆助手):** https://n0vi028.github.io/JS-Slash-Runner-Doc/
- **MVU ZOD CDN:** https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js

---

> **Tổng hợp bởi:** Hệ thống d-ch-card-sillytarven
> **Nguồn:** EJS实战指南_2026_ZOD版.md (秋青子), MVU_ZOD指南.md (秋青子), ST-Prompt-template_Detailed_Analysis.md, EJS_SillyTavern_Analysis.md
