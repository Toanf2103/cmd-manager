# Chính sách quyền riêng tư — CMD Manager

Cập nhật lần cuối: 23/11/2026

CMD Manager là ứng dụng desktop chạy hoàn toàn trên máy Windows của bạn. Tài liệu này
mô tả dữ liệu ứng dụng xử lý và nơi lưu trữ dữ liệu đó.

## Tóm tắt

- CMD Manager **không thu thập, không gửi và không chia sẻ** dữ liệu cá nhân với nhà phát triển hay bất kỳ bên thứ ba nào.
- Ứng dụng **không có** tài khoản người dùng, quảng cáo, phân tích (analytics), telemetry hay báo cáo sự cố tự động.
- Mọi dữ liệu bạn tạo đều được lưu **cục bộ trên máy của bạn**.

## Dữ liệu được lưu trên máy

| Dữ liệu | Nơi lưu | Mục đích |
|---|---|---|
| Lệnh, danh mục, thư mục làm việc, tuỳ chọn chạy | `localStorage` trong thư mục dữ liệu ứng dụng (mặc định `%APPDATA%\CMD Manager`) | Lưu cấu hình bạn tạo |
| Log thực thi | Bộ nhớ RAM khi ứng dụng đang chạy | Hiển thị kết quả lệnh; không ghi ra đĩa |
| Tệp tạm cho chế độ Administrator | `%TEMP%\cmd-manager` | Truyền lệnh và log giữa ứng dụng và tiến trình chạy bằng quyền Administrator; được tự động dọn dẹp |
| File sao lưu (khi bạn chủ động Xuất) | Vị trí bạn chọn | Sao lưu hoặc chuyển dữ liệu sang máy khác |

Lệnh, đường dẫn và log có thể chứa thông tin nhạy cảm do chính bạn nhập. Dữ liệu này không
được mã hóa riêng; hãy bảo vệ tài khoản Windows của bạn và không lưu mật khẩu trong lệnh.

## Kết nối mạng

Bản thân CMD Manager không gửi yêu cầu mạng nào. Các lệnh **do bạn tự cấu hình** (ví dụ
`git pull`, `npm install`) có thể truy cập mạng; hoạt động đó thuộc về chương trình bạn chạy,
không phải CMD Manager. Khi bạn bấm vào liên kết web, liên kết sẽ được mở bằng trình duyệt mặc định.

## Quyền hệ thống

- **runFullTrust**: cần để ứng dụng desktop chạy các trình thông dịch lệnh (cmd, PowerShell, Git Bash, WSL, Windows Terminal) có trên máy.
- **allowElevation**: chỉ dùng khi bạn bật "Chạy với quyền Administrator" cho một lệnh; Windows luôn hỏi xác nhận qua UAC.

## Xoá dữ liệu

Gỡ cài đặt ứng dụng sẽ xoá dữ liệu ứng dụng. Bạn cũng có thể xoá từng lệnh, danh mục trong
ứng dụng, hoặc xoá thư mục `%APPDATA%\CMD Manager`.

## Trẻ em

Ứng dụng không hướng tới trẻ em và không thu thập thông tin của bất kỳ ai.

## Thay đổi

Mọi thay đổi chính sách sẽ được cập nhật tại trang này trong kho mã nguồn.

## Liên hệ

- Email: nobitakute002@gmail.com
- GitHub Issues: https://github.com/Toanf2103/cmd-manager/issues

---

# Privacy Policy — CMD Manager (English)

Last updated: November 23, 2026

CMD Manager runs entirely on your Windows PC. It **does not collect, transmit or share** any
personal data with the developer or any third party. It has no user accounts, ads, analytics,
telemetry or automatic crash reporting.

- Commands, categories and settings you create are stored locally in the app's data folder
  (`%APPDATA%\CMD Manager`). Execution logs are kept in memory only.
- Temporary files in `%TEMP%\cmd-manager` are used only to pass commands and logs to the
  elevated runner when you choose "Run as Administrator", and are cleaned up automatically.
- Backup files are written only when you export, to the location you choose.
- The app itself makes no network requests. Commands you configure may access the network on
  their own; that activity belongs to the programs you run.
- `runFullTrust` is required to launch local shells; `allowElevation` is used only when you
  enable "Run as Administrator" for a command, and Windows always shows a UAC prompt.
- Uninstalling the app removes its data. You can also delete `%APPDATA%\CMD Manager`.

Contact: nobitakute002@gmail.com · https://github.com/Toanf2103/cmd-manager/issues
