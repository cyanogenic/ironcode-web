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
3. 按 `deploy/r2/cors.example.json` 配置 bucket CORS，并把示例域名替换成员工后台的实际域名。
4. API 只签发 5 分钟有效的 PUT/GET URL。上传后必须调用完成接口，API 会通过 HEAD 校验 MIME 和文件大小；校验失败的对象会立即删除。

客户故障照片、检测照片、交付凭证与质保文件均使用不可预测的对象键，数据库负责记录对象归属。前端从不保存 R2 凭据，也不会直接拼接对象 URL。

## 本地开发

1. 复制 `.env.example` 为 `.env`，替换所有示例密钥。
2. 启动 PostgreSQL：`docker compose -f deploy/compose/development.yml up -d`。
3. 安装依赖：`pnpm install`。
4. 生成 Prisma 客户端并迁移数据库：`pnpm db:generate && pnpm db:migrate`。
5. 启动开发服务：`pnpm dev`。

开发环境的 `OTP_PROVIDER=console` 会把验证码写入 API 日志；生产环境会拒绝使用该提供器。

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

## 安全边界

- 客户通过手机号验证码登录；员工通过用户名和密码登录。
- 短期访问令牌由前端保存在内存中，刷新令牌只放在 HttpOnly Cookie。
- 生产环境要求 HTTPS、安全 Cookie、明确的跨域来源和真实短信提供器。
- 数据库与对象存储不直接暴露给浏览器。
