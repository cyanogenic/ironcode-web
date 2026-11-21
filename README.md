# 铁码维修服务

铁码维修正在从静态交互原型重构为可自托管的正式业务系统。现有 `dist/` 仅作为视觉和流程参考，不是生产业务实现。

## 目标结构

- `apps/web`：客户网站
- `apps/staff`：工程师与管理员后台
- `apps/api`：NestJS API
- `packages/contracts`：共享接口类型与校验约定
- `deploy`：本地依赖、生产容器、备份和反向代理配置

数据使用 PostgreSQL，私有文件使用 Cloudflare R2。R2 密钥只允许出现在 API 服务端；浏览器通过短时签名 URL 上传和读取对象。

### Cloudflare R2

1. 创建一个保持私有的 R2 bucket，不启用公开开发 URL。
2. 创建仅能操作该 bucket 的 S3 API Token，把账户 ID、Access Key、Secret 和 bucket 名填入服务器环境变量。
3. 在 R2 bucket 的 CORS 设置中允许站点的 HTTPS 来源。`AllowedOrigins` 填写域名和协议，省略 `/staff` 路径。本地开发时可保留 `http://localhost:5174`。

```json
[
  {
    "AllowedOrigins": ["https://ironcode.cn", "http://localhost:5174"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

该配置允许员工后台使用 API 签发的临时 URL，跨域向私有 R2 bucket 上传文件；它不替代 R2 的私有权限和签名 URL 校验。
4. API 只签发 5 分钟有效的 PUT/GET URL。上传后必须调用完成接口，API 会通过 HEAD 校验 MIME 和文件大小；校验失败的对象会立即删除。

客户故障照片、检测照片、交付凭证与质保文件均使用不可预测的对象键，数据库负责记录对象归属。前端从不保存 R2 凭据，也不会直接拼接对象 URL。

## 生产部署

生产环境使用一个域名。客户访问 `https://ironcode.cn/`，员工访问 `https://ironcode.cn/staff`，浏览器会跳转到 `/staff/`。两个前端都通过同一域名下的 `/api/` 访问后端。

首次部署时复制 `.env.example` 为 `.env` 并填写生产密钥和数据库密码。已有部署可直接更新 `.env` 中的域名配置，并移除旧的 `STAFF_HOST`。

```dotenv
CUSTOMER_HOST=ironcode.cn
APP_ORIGINS=https://ironcode.cn
```

在外层 HTTPS 反向代理中，把 `ironcode.cn` 的全部路径转发到 `http://127.0.0.1:8080`，保留原请求路径和 `Host`。首次部署和升级都使用以下命令。升级前先备份 PostgreSQL。

```bash
docker compose up -d --pull always
```

Compose 会等 PostgreSQL 可以接收 TCP 连接，再用与应用相同的镜像启动 `migrate` 服务，执行 `prisma migrate deploy`。空库会应用全部迁移，已有库只应用待执行的迁移。`migrate` 以状态码 `0` 退出后，Compose 才会启动应用。

如果迁移失败，Compose 会停止启动本次部署的应用。查看迁移日志和数据库的实际状态，修复失败的迁移后重新执行部署命令。回退应用镜像需要另行检查数据库结构与旧版本是否兼容。

```bash
docker compose logs migrate
```

GitHub Actions 会在 `main` 分支或版本标签推送后构建并发布 `ghcr.io/<owner>/ironcode-web` 镜像。应用容器内由 Nginx 提供客户网站和员工后台，并将 `/api` 反向代理到 NestJS API。

开发环境的 `OTP_PROVIDER=console` 会把短信验证码写入 API 日志；生产环境会拒绝为已启用的手机号登录使用该提供器。客户手机号和邮箱登录可以分别开关，但至少要启用一种：

```dotenv
CUSTOMER_PHONE_LOGIN_ENABLED=true
CUSTOMER_EMAIL_LOGIN_ENABLED=true
```

### 阿里云短信

生产环境把 `OTP_PROVIDER` 设置为 `aliyun`，并配置专用 RAM 用户的 AccessKey、已审核通过的短信签名和模板编码。验证码模板必须包含名为 `code` 的变量；API 会按 `{"code":"123456"}` 的 JSON 参数发送。

建议只给 RAM 用户授予发送短信所需的最小权限。阿里云密钥只能保存在 API 服务端环境变量中，不能写入仓库或前端：

```dotenv
OTP_PROVIDER=aliyun
ALIYUN_SMS_ACCESS_KEY_ID=
ALIYUN_SMS_ACCESS_KEY_SECRET=
ALIYUN_SMS_SIGN_NAME=
ALIYUN_SMS_TEMPLATE_CODE=
ALIYUN_SMS_ENDPOINT=dysmsapi.aliyuncs.com
```

发送失败时 API 返回 503，并删除本次未送达的验证码记录，因此不会触发下一次请求的冷却时间。日志只记录脱敏手机号、阿里云请求 ID 和错误码，不记录验证码或密钥。

## 邮箱验证码与 SMTP

客户可以使用邮箱验证码登录，也可以登录后在“账号”中绑定手机号或邮箱。首次用一个尚未绑定的邮箱登录会创建新客户账号；系统不会根据姓名或预约联系电话自动合并账号。

开发环境可使用 `EMAIL_PROVIDER=console` 在 API 日志中查看邮件验证码。生产环境启用邮箱登录时必须使用 SMTP：

```dotenv
CUSTOMER_EMAIL_LOGIN_ENABLED=true
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=noreply@example.com
SMTP_PASSWORD=
SMTP_FROM_NAME=铁码维修
SMTP_FROM_ADDRESS=noreply@example.com
```

端口 465 通常设置 `SMTP_SECURE=true`；端口 587 使用 `false`，服务会要求 STARTTLS 并至少使用 TLS 1.2。用户名和密码必须同时配置，也可以同时留空以支持可信内网 SMTP 中继。

## 安全边界

- 客户通过手机号或邮箱验证码登录；员工通过用户名和密码登录。
- 短期访问令牌由前端保存在内存中，刷新令牌只放在 HttpOnly Cookie。
- 生产环境要求 HTTPS、安全 Cookie、明确的跨域来源和真实短信提供器。
- 数据库与对象存储不直接暴露给浏览器。
