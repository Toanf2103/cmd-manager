# Đóng góp cho CMD Manager

Bạn có thể báo lỗi, đề xuất tính năng, cải thiện tài liệu hoặc gửi pull request.
Trao đổi lịch sự, tập trung vào vấn đề và tôn trọng người tham gia.

## Chuẩn bị

- Windows x64, Git và Node.js từ 22.12.0 trở lên, kèm npm.
- Fork repository, sau đó clone bản fork về máy.
- Chạy `npm ci` để cài đúng các phiên bản trong `package-lock.json`.
- Chạy `npm start` để mở ứng dụng.

## Nhánh và commit

`main` là nhánh tích hợp. Mỗi thay đổi thực hiện trên một nhánh riêng:

```sh
git switch main
git pull --ff-only
git switch -c fix/mo-ta-ngan
```

Dùng tiền tố nhánh `feat/`, `fix/`, `docs/` hoặc `chore/` theo nội dung.
Đặt tên commit ngắn gọn, mô tả kết quả, ví dụ:

```text
fix: keep commands running when the window closes
docs: explain command parameters
chore: configure repository line endings
```

Tách các thay đổi độc lập thành các commit riêng. Không sửa lại lịch sử chung
hoặc force push lên `main`.

## Quy tắc mã nguồn

- Giữ cấu trúc CommonJS, JavaScript thuần và phong cách hiện có.
- Chỉ sửa phần liên quan; ưu tiên mã đơn giản, rõ ràng và dùng lại helper sẵn có.
- Lưu tệp văn bản bằng UTF-8 không BOM. Giữ nguyên tiếng Việt, dấu và emoji.
- `.editorconfig` và `.gitattributes` quy định định dạng và xuống dòng.
- Commit `package-lock.json` cùng thay đổi dependency; không commit `node_modules/`,
  `dist/`, `.env`, dữ liệu sao lưu hoặc thông tin bí mật.
- Giữ các tùy chọn bảo vệ Electron như `contextIsolation`, `sandbox` và CSP;
  kiểm tra dữ liệu khi thêm IPC mới.

## Kiểm tra và gửi pull request

Chạy các kiểm tra nhẹ trước khi gửi:

```sh
npm run check
git diff --check
```

`npm run check` chỉ kiểm tra cú pháp JavaScript, không chạy ứng dụng, test hay build.
Nếu kiểm tra giao diện thủ công, ghi rõ thao tác và kết quả trong pull request.
Không tự động chạy test, build, Docker, E2E, publish hoặc tạo migration; chỉ thực
hiện khi có yêu cầu cụ thể.

Pull request cần mô tả vấn đề, hành vi sau thay đổi, cách kiểm tra và giới hạn
còn lại. Với thay đổi giao diện, đính kèm ảnh nếu có. Cập nhật README khi thay đổi
cách cài đặt hoặc sử dụng.

Báo lỗi thông thường qua [GitHub Issues](https://github.com/Toanf2103/cmd-manager/issues).
Với vấn đề bảo mật, xem [SECURITY.md](SECURITY.md).

Các đóng góp được phân phối theo [giấy phép MIT](LICENSE) của dự án.
