# Bảo mật

## Phạm vi

CMD Manager chạy lệnh trực tiếp trên máy với quyền của người dùng, hoặc quyền
Administrator khi được chấp thuận qua UAC. Ứng dụng không cách ly các lệnh trong
một môi trường an toàn. Chỉ chạy lệnh và nhập file sao lưu từ nguồn bạn tin cậy.

Tham số `{tên}` được thay nguyên văn vào lệnh, không tự escape ký tự của shell.
Lệnh, đường dẫn và log có thể chứa thông tin nhạy cảm. Dữ liệu `localStorage`,
file sao lưu và tệp tạm phục vụ runner không phải kho lưu trữ bí mật được mã hóa.

## Báo cáo lỗ hổng

Không đăng công khai mật khẩu, token, dữ liệu cá nhân hoặc mã khai thác trong
issue. Gửi báo cáo riêng tới người duy trì qua
[email](mailto:nobitakute002@gmail.com). Nếu GitHub cung cấp nút
**Report a vulnerability** ở tab **Security**,
bạn cũng có thể dùng kênh báo cáo riêng đó.

Báo cáo nên nêu phiên bản hoặc commit bị ảnh hưởng, môi trường, các bước tái hiện,
tác động và ví dụ tối thiểu đã loại bỏ dữ liệu nhạy cảm.

Việc đánh giá và sửa lỗi tập trung vào mã nguồn trên nhánh `main`; các phiên bản
cũ chưa có cam kết hỗ trợ riêng. Dự án không cam kết thời gian phản hồi cố định.
