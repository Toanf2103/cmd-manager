<p align="center"><img src="build/icon.png" width="96" alt="Logo CMD Manager"></p>

# CMD Manager

App Electron để lưu, quản lý và chạy các chuỗi lệnh cmd ngay trên máy Windows.

[Mã nguồn](https://github.com/Toanf2103/cmd-manager) · [Báo lỗi](https://github.com/Toanf2103/cmd-manager/issues) · [Đóng góp](CONTRIBUTING.md) · [Bảo mật](SECURITY.md) · [Giấy phép MIT](LICENSE)

## Yêu cầu

- Windows x64 để sử dụng đầy đủ tính năng và đóng gói các bản `.exe` hiện có.
- Khi chạy từ mã nguồn: Git, Node.js **từ 22.12.0** trở lên và npm. Đây là yêu cầu của phiên bản Electron trong lockfile.
- Cài riêng PowerShell 7, Git Bash, MSYS2, Cygwin, WSL hoặc Windows Terminal nếu muốn dùng các môi trường đó.

## Tính năng

- Tạo lệnh gồm **tên**, **danh mục**, **đường dẫn mở cmd** và **nhiều lệnh chạy lần lượt**
- Nút **Chạy / Reset / Tắt** cho từng lệnh, có thể chạy nhiều lệnh cùng lúc
- **Log realtime** (stdout/stderr) với tự cuộn, sao chép và xoá log
- **Danh mục**: nhóm lệnh, đổi màu, sắp xếp, thu gọn trong sidebar
- **Môi trường thực thi**: tự quét trên máy và cho chọn cmd, Windows PowerShell 5.1, PowerShell 7+, Git Bash, MSYS2, Cygwin, từng distro WSL, Windows Terminal (nút "Quét lại" để quét lại)
- **Chạy với quyền Administrator** cho từng lệnh (Windows hỏi UAC), vẫn có log realtime và nút Tắt
- **Chạy nền ở khay hệ thống**: đóng cửa sổ vẫn giữ các lệnh tiếp tục chạy, bấm biểu tượng để mở lại
- **Tham số `{tên}`**: tự hiện form nhập giá trị trước khi chạy, dùng chung giá trị cho các chỗ trùng tên
- Lưu toàn bộ dữ liệu bằng `localStorage` ngay trên máy
- Tiện ích: tìm kiếm (Ctrl+F), tạo nhanh (Ctrl+N), nhân bản lệnh, mở thư mục trong Explorer, mở cửa sổ cmd thật tại thư mục

## Chạy thử

```sh
git clone https://github.com/Toanf2103/cmd-manager.git
cd cmd-manager
npm ci
npm start
```

`npm ci` cài dependency theo `package-lock.json`. Electron được tải ở lần cài đầu nên cần kết nối mạng.

## Sử dụng nhanh

1. Bấm **Tạo lệnh mới** hoặc `Ctrl+N`.
2. Đặt tên, chọn thư mục làm việc, môi trường thực thi và nhập các bước lệnh.
3. Bấm **Lưu & chạy**, hoặc lưu lại rồi bấm **Chạy** khi cần.
4. Xem log và trạng thái trong ứng dụng. Bấm **Tắt** để dừng lệnh.
5. Bấm **X**, `Alt+F4` hoặc `Esc` để chạy nền; chọn **Thoát** trong menu khay hệ thống để thoát hẳn.

Chỉ chạy các lệnh bạn hiểu và tin cậy. Ứng dụng thực thi lệnh với quyền trên máy của bạn; xem [lưu ý bảo mật](SECURITY.md), nhất là khi nhập file sao lưu hoặc dùng Administrator.

## Build ra exe

Chạy trên Windows sau khi cài dependency:

```sh
npm run build
npm run build:portable
npm run build:setup
```

Ba lệnh trên lần lượt tạo cả hai bản, chỉ bản portable và chỉ bộ cài NSIS. Chọn lệnh phù hợp với đầu ra cần tạo.

File exe nằm trong thư mục `dist\`:

- `CMD-Manager-1.0.0-portable.exe`: chạy trực tiếp, không cần cài
- `CMD Manager Setup 1.0.0.exe`: bộ cài

> Nếu build báo lỗi quyền tạo symlink (winCodeSign), hãy mở terminal bằng **Run as administrator** hoặc bật **Developer Mode** trong Windows Settings rồi build lại.

## Cách hoạt động

| Thao tác | Hành vi |
|---|---|
| Chạy | Chạy các bước lần lượt trong thư mục đã chọn, bằng môi trường thực thi đã chọn. Với cmd, output được đặt UTF-8 (`chcp 65001`) |
| Lệnh lỗi | Exit code ≠ 0 → bước đó báo **Lỗi**. Nếu bật "Dừng khi lỗi" thì dừng cả chuỗi |
| Tắt | `taskkill /PID <pid> /T /F`, tắt cả cây tiến trình con (dev server, node, dotnet…) |
| Reset | Tắt nếu đang chạy, xoá log, đưa về trạng thái **Chờ** |
| Đóng cửa sổ (X / Alt+F4 / Esc) | Ẩn cửa sổ vào khay hệ thống và tiếp tục chạy nền, không hỏi xác nhận; Esc đóng hộp thoại trước nếu đang mở |
| Thoát app | Chọn **Thoát** trong menu khay hệ thống sẽ tắt các tiến trình do ứng dụng quản lý và thoát hẳn |

### Chạy nền ở khay hệ thống

- Bấm X, Alt+F4 hoặc Esc (khi không mở hộp thoại) để ẩn cửa sổ khỏi taskbar và chạy nền ngay, không hỏi xác nhận. Ứng dụng vẫn nhận log và giữ các lệnh tiếp tục chạy.
- Bấm biểu tượng CMD Manager trong khay hệ thống để mở lại. Windows có thể đặt biểu tượng trong menu mở rộng ở nút mũi tên cạnh đồng hồ.
- Menu chuột phải của biểu tượng có **Mở CMD Manager** và **Thoát**. Chọn **Thoát** sẽ dừng các lệnh do ứng dụng quản lý và thoát hẳn.
- Mở CMD Manager lần nữa khi đang chạy nền sẽ hiện lại cửa sổ hiện có.
- Nút **Tắt** của từng lệnh vẫn chỉ dừng lệnh đó.

### Tham số khi chạy lệnh

Đặt `{tên}` trong một hoặc nhiều bước lệnh. Khi bấm **Chạy**, chạy nhanh ở sidebar hoặc **Lưu & chạy**, ứng dụng sẽ hiện form **Nhập tham số** trước khi thực thi.

Ví dụ: lưu `dotnet run {admin}`, nhập `123` ở ô **admin** → lệnh thực tế là `dotnet run 123`.

- Tên bắt đầu bằng chữ hoặc `_`, theo sau là chữ, số hoặc `_`; hỗ trợ tiếng Việt và phân biệt hoa/thường, ví dụ `{tên}`, `{port}`, `{_options}`.
- Mỗi tên chỉ có một ô nhập, kể cả khi xuất hiện nhiều lần hoặc trong nhiều bước; các ô theo thứ tự xuất hiện.
- Cho phép để trống. Giá trị được thay nguyên văn một lượt, không tự thêm dấu nháy và không diễn giải tiếp các dấu `{}` trong giá trị vừa nhập.
- Nếu giá trị có khoảng trắng và cần là một đối số, đặt dấu nháy trong lệnh mẫu, ví dụ `echo "{message}"`.
- Enter hoặc nút **Chạy** xác nhận; **Huỷ**, nút đóng hoặc Esc bỏ qua lần chạy, giữ nguyên log và trạng thái.
- Mỗi lần chạy nhập lại từ đầu; không lưu giá trị tham số. Cấu hình và file sao lưu vẫn giữ nguyên lệnh mẫu `{tên}`, log thực thi hiển thị lệnh đã thay giá trị.
- Chỉ quét nội dung các bước lệnh, không quét tên lệnh hoặc thư mục. Không có tham số thì chạy ngay như trước. Áp dụng cho mọi môi trường thực thi và chế độ Administrator.

### Môi trường thực thi

| Môi trường | Cách chạy mỗi lệnh | Log trong app |
|---|---|---|
| Command Prompt | `cmd.exe /d /s /c "chcp 65001 & <lệnh>"` | Có |
| Windows PowerShell / PowerShell 7 | `powershell -NoProfile -EncodedCommand …` (UTF-8, exit code ≠ 0 hoặc lỗi cmdlet = lỗi) | Có |
| Git Bash / MSYS2 / Cygwin | `bash -lc "<lệnh>"` | Có |
| WSL (từng distro) | `wsl -d <distro> --cd <thư mục> -- bash -lc "<lệnh>"` | Có |
| Windows Terminal | Sinh file `.cmd` tạm rồi `wt -d <thư mục> cmd /k run.cmd` | Không, log nằm trong cửa sổ Terminal |

### Quyền Administrator

Khi tick "Chạy với quyền Administrator" mà app không chạy bằng admin, mỗi lần bấm Chạy:

1. App mở lại chính nó ở chế độ runner (`--cmdm-runner job.json`) qua `Start-Process -Verb RunAs`, nên Windows sẽ hỏi UAC.
2. Runner (đã có quyền admin) chạy chuỗi lệnh và ghi log ra file tạm trong `%TEMP%\cmd-manager\…`; app đọc file này để hiện log realtime.
3. Bấm Tắt thì app tạo file `stop`, runner nhận được sẽ `taskkill /T /F` cây tiến trình.

Muốn khỏi bị hỏi UAC mỗi lần, hãy mở hẳn CMD Manager bằng **Run as administrator** (góc trên sẽ hiện nhãn *Admin*), khi đó mọi lệnh admin chạy trực tiếp.

Với WSL, nút Tắt đóng tiến trình `wsl.exe` phía Windows; một số tiến trình chạy nền bên trong Linux có thể vẫn còn sống.

Lưu ý: mỗi lệnh chạy trong một tiến trình riêng, nên `cd` hay `set` ở lệnh trước **không** ảnh hưởng tới lệnh sau. Nếu cần, gộp chúng thành một dòng bằng `&&`, ví dụ `cd src && npm run build`.

Dữ liệu lưu trong `localStorage` ở thư mục dữ liệu người dùng của Electron. Với cấu hình hiện tại trên Windows, mặc định là `%APPDATA%\CMD Manager`:

- `cmdm.categories`: `[{ id, name, color, locked? }]`
- `cmdm.commands`: `[{ id, categoryId, name, cwd, steps: string[], shell, admin, stopOnError, clearOnRun }]`

## Sao lưu: xuất / nhập

- **Xuất**: lưu toàn bộ lệnh và danh mục ra file `cmd-manager-backup-YYYYMMDD-HHmm.json` (mặc định đặt trong Documents).
- **Nhập**: chọn file JSON, xem tóm tắt rồi chọn một trong hai cách:
  - *Gộp*: thêm mục mới, mục trùng id được cập nhật theo file, không xoá gì.
  - *Thay thế toàn bộ*: dùng hoàn toàn dữ liệu trong file.

Dữ liệu hằng ngày nằm trong thư mục dữ liệu người dùng, nên build lại exe không tự xóa dữ liệu. File xuất ra dùng để phòng hờ hoặc chuyển sang máy khác. Sao lưu trước khi cập nhật hoặc thay đổi cấu hình ứng dụng.

## Cấu trúc

```
build/               biểu tượng ứng dụng, bản gốc SVG và tài nguyên đóng gói
src/
  main.js            điểm vào: app thường hoặc chế độ runner (admin)
  app-main.js        cửa sổ, IPC, chạy admin qua UAC, mở Windows Terminal
  engine.js          bộ máy chạy chuỗi lệnh theo từng môi trường, taskkill
  shells.js          quét các môi trường thực thi có trên máy, kiểm tra quyền admin
  runner.js          chế độ runner chạy bằng quyền Administrator
  preload.js         cầu nối IPC an toàn (window.api)
  assets/            icon cửa sổ và icon khay hệ thống khi chờ / đang chạy
  renderer/
    index.html
    styles.css
    app.js           giao diện, lưu localStorage
.github/             mẫu issue, pull request và kiểm tra cú pháp trên GitHub
CONTRIBUTING.md      hướng dẫn đóng góp, nhánh và commit
SECURITY.md          phạm vi bảo mật và cách báo cáo riêng
LICENSE              giấy phép MIT
```

Phím tắt: `F12` mở DevTools, `Ctrl+N` tạo lệnh, `Ctrl+F` tìm kiếm, `Esc` đóng hộp thoại nếu đang mở, hoặc ẩn cửa sổ để chạy nền. Trong form, `Enter` thêm dòng lệnh mới, `Ctrl+Enter` lưu và chạy.

## Phát triển và đóng góp

Xem [CONTRIBUTING.md](CONTRIBUTING.md) để tạo nhánh, gửi commit và pull request. Dự án dùng JavaScript thuần, CommonJS và Electron; không cần bước biên dịch giao diện trước `npm start`.

```sh
npm run check
git diff --check
```

Các lệnh này kiểm tra cú pháp JavaScript và khoảng trắng, không chạy test hoặc build. GitHub Actions chạy kiểm tra cú pháp cho pull request và commit trên `main`.

Tệp văn bản dùng **UTF-8 không BOM**, giữ nguyên tiếng Việt và emoji. `.editorconfig` và `.gitattributes` thống nhất định dạng và xuống dòng giữa các máy. `package-lock.json` được commit để cài dependency nhất quán.

`private: true` trong `package.json` ngăn việc publish nhầm lên npm; mã nguồn vẫn được phân phối theo MIT.

## Giới hạn

- Các bản đóng gói hiện tại chỉ cấu hình cho Windows x64; macOS và Linux chưa được xác nhận hỗ trợ đầy đủ.
- Log trong giao diện được giữ trong bộ nhớ, tối đa 5.000 dòng cho mỗi lệnh; file sao lưu chứa cấu hình lệnh và danh mục, không chứa lịch sử log.
- Windows Terminal hiển thị log ở cửa sổ riêng. Việc dừng tiến trình bên trong WSL có giới hạn như mô tả ở trên.
- Tham số được thay nguyên văn vào lệnh; bạn cần tự đặt dấu nháy phù hợp với shell.

## Giấy phép

Copyright © 2026 Toanf2103. Phát hành theo [giấy phép MIT](LICENSE). Các dependency giữ giấy phép riêng của từng dự án.
