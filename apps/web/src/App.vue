<script setup lang="ts">
import type {
  AuthUser,
  CreateOrderInput,
  RepairOrder,
  RepairOrderStatus,
  ServiceMode,
  SupportTicket,
} from "@ironcode/contracts";
import { computed, onMounted, reactive, ref } from "vue";
import {
  cancelOrder,
  createOrder,
  decideQuote,
  closeTicket,
  createTicket,
  listOrders,
  listTickets,
  logout,
  refreshSession,
  replyTicket,
  requestCode,
  verifyCode,
} from "./api";

const phone = ref("");
const code = ref("");
const step = ref<"phone" | "code">("phone");
const user = ref<AuthUser | null>(null);
const orders = ref<RepairOrder[]>([]);
const tickets = ref<SupportTicket[]>([]);
const view = ref<"orders" | "booking" | "support">("orders");
const loading = ref(true);
const submitting = ref(false);
const error = ref("");
const ticketForm = reactive({ subject: "", body: "", orderId: "" });
const replyDrafts = reactive<Record<string, string>>({});
const booking = reactive({
  serviceMode: "IN_STORE" as ServiceMode,
  category: "笔记本电脑",
  brand: "",
  model: "",
  problemDescription: "",
  date: "",
  time: "09:00",
  recipient: "",
  phone: "",
  province: "",
  city: "",
  district: "",
  detail: "",
  accepted: false,
});

const minDate = computed(() => {
  const tomorrow = new Date(Date.now() + 86400000);
  return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
});
const statusNames: Record<RepairOrderStatus, string> = {
  APPOINTMENT_PENDING: "预约待确认",
  APPOINTMENT_CONFIRMED: "预约已确认",
  RECEIVED: "设备已接收",
  DIAGNOSING: "检测中",
  QUOTE_PENDING_CUSTOMER: "待确认报价",
  QUOTE_REJECTED: "报价已拒绝",
  WAITING_REPAIR: "待维修",
  REPAIRING: "维修中",
  TESTING: "测试中",
  READY_FOR_DELIVERY: "待交付",
  COMPLETED: "已完成",
  CANCELED: "已取消",
  WARRANTY_RETURN: "质保返修",
};

onMounted(async () => {
  try {
    user.value = (await refreshSession()).user;
    await Promise.all([loadOrders(), loadTickets()]);
  } catch {
    /* Signed out is normal. */
  } finally {
    loading.value = false;
  }
});
async function loadOrders() {
  orders.value = await listOrders();
}
async function loadTickets() {
  tickets.value = await listTickets();
}
async function sendCode() {
  error.value = "";
  submitting.value = true;
  try {
    await requestCode(phone.value);
    step.value = "code";
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "验证码发送失败";
  } finally {
    submitting.value = false;
  }
}
async function signIn() {
  error.value = "";
  submitting.value = true;
  try {
    user.value = (await verifyCode(phone.value, code.value)).user;
    await Promise.all([loadOrders(), loadTickets()]);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "登录失败";
  } finally {
    submitting.value = false;
  }
}
async function signOut() {
  await logout();
  user.value = null;
  orders.value = [];
  tickets.value = [];
  code.value = "";
  step.value = "phone";
}

async function submitBooking() {
  error.value = "";
  submitting.value = true;
  try {
    const start = new Date(`${booking.date}T${booking.time}:00+08:00`);
    const input: CreateOrderInput = {
      serviceMode: booking.serviceMode,
      problemDescription: booking.problemDescription,
      scheduledStart: start.toISOString(),
      scheduledEnd: new Date(start.getTime() + 7200000).toISOString(),
      device: {
        category: booking.category,
        model: booking.model,
        ...(booking.brand ? { brand: booking.brand } : {}),
      },
      acceptedServiceTerms: booking.accepted,
      acceptedPrivacyPolicy: booking.accepted,
      policyVersion: "2026-11-14",
      ...(booking.serviceMode === "ONSITE"
        ? {
            address: {
              recipient: booking.recipient,
              phone: booking.phone,
              province: booking.province,
              city: booking.city,
              district: booking.district,
              detail: booking.detail,
            },
          }
        : {}),
    };
    await createOrder(input);
    await loadOrders();
    view.value = "orders";
    resetBooking();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "预约提交失败";
  } finally {
    submitting.value = false;
  }
}
async function cancel(order: RepairOrder) {
  if (!window.confirm(`确认取消预约 ${order.orderNo}？`)) return;
  error.value = "";
  try {
    await cancelOrder(order.id);
    await loadOrders();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "取消失败";
  }
}
async function respondToQuote(
  order: RepairOrder,
  decision: "accept" | "reject",
) {
  const quote = order.quotes.find((item) => item.status === "PENDING_CUSTOMER");
  if (!quote) return;
  if (
    !window.confirm(
      decision === "accept"
        ? `确认报价 ¥${quote.total} 并进入维修？`
        : "确认拒绝这份报价？",
    )
  )
    return;
  error.value = "";
  try {
    await decideQuote(order.id, quote.id, order.version, decision);
    await loadOrders();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "报价处理失败";
  }
}
async function submitTicket() {
  error.value = "";
  submitting.value = true;
  try {
    await createTicket({
      subject: ticketForm.subject,
      body: ticketForm.body,
      ...(ticketForm.orderId ? { orderId: ticketForm.orderId } : {}),
    });
    ticketForm.subject = "";
    ticketForm.body = "";
    ticketForm.orderId = "";
    await loadTickets();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "工单提交失败";
  } finally {
    submitting.value = false;
  }
}
async function sendTicketReply(ticketId: string) {
  const body = replyDrafts[ticketId]?.trim();
  if (!body) return;
  try {
    await replyTicket(ticketId, body);
    replyDrafts[ticketId] = "";
    await loadTickets();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "回复失败";
  }
}
async function finishTicket(ticketId: string) {
  await closeTicket(ticketId);
  await loadTickets();
}
function resetBooking() {
  booking.model = "";
  booking.brand = "";
  booking.problemDescription = "";
  booking.date = "";
  booking.accepted = false;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}
</script>

<template>
  <main class="auth-page" :class="{ signed: user }">
    <section class="brand-panel">
      <div class="brand"><span>铁</span><strong>铁码维修</strong></div>
      <div class="brand-copy">
        <p class="eyebrow">DIGITAL CARE</p>
        <h1>修好设备，<br />也修好你的安心。</h1>
        <p>透明检测、确认后维修、全程可追踪。每一次操作，都由你决定。</p>
      </div>
      <div class="trust">
        <span>先检测 后报价</span><span>数据操作单独授权</span
        ><span>维修记录可追溯</span>
      </div>
    </section>
    <section class="form-panel">
      <div v-if="loading" class="auth-card"><p>正在检查登录状态…</p></div>
      <div v-else-if="user" class="auth-card dashboard">
        <header class="dashboard-head">
          <div>
            <p class="eyebrow">CUSTOMER SERVICE</p>
            <h2>
              {{
                view === "orders"
                  ? "我的维修"
                  : view === "booking"
                    ? "预约维修"
                    : "服务留言"
              }}
            </h2>
          </div>
          <div class="head-actions">
            <button class="text-button" @click="view = 'orders'">订单</button>
            <button class="text-button" @click="view = 'booking'">预约</button>
            <button class="text-button" @click="view = 'support'">留言</button>
            <button class="text-button muted-button" @click="signOut">
              退出
            </button>
          </div>
        </header>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <div v-if="view === 'orders'" class="order-list">
          <div v-if="!orders.length" class="empty">
            还没有维修订单。<button
              class="text-button"
              @click="view = 'booking'"
            >
              现在预约
            </button>
          </div>
          <article v-for="order in orders" :key="order.id" class="order-card">
            <div class="order-title">
              <div>
                <strong
                  >{{ order.device?.brand }} {{ order.device?.model }}</strong
                ><small>{{ order.orderNo }}</small>
              </div>
              <span class="status">{{ statusNames[order.status] }}</span>
            </div>
            <p>{{ order.problemDescription }}</p>
            <div class="order-meta">
              <span>{{
                order.serviceMode === "ONSITE" ? "上门维修" : "到店检测"
              }}</span
              ><span>{{ formatDate(order.scheduledStart) }}</span
              ><span>{{ order.store.name }}</span>
            </div>
            <div
              v-if="
                order.payments.some((payment) => payment.status === 'SUCCEEDED')
              "
              class="payment-ok"
            >
              ✓ 已完成到店付款
            </div>
            <div v-if="order.inspections[0]" class="report">
              <strong>检测结论</strong>
              <p>{{ order.inspections[0].cause }}</p>
              <small>{{ order.inspections[0].solution }}</small>
            </div>
            <div
              v-if="
                order.status === 'QUOTE_PENDING_CUSTOMER' && order.quotes[0]
              "
              class="quote"
            >
              <div v-for="item in order.quotes[0].items" :key="item.id">
                <span>{{ item.name }} × {{ item.quantity }}</span
                ><strong>¥{{ item.total }}</strong>
              </div>
              <div class="quote-total">
                <span>合计</span><strong>¥{{ order.quotes[0].total }}</strong>
              </div>
              <div class="quote-actions">
                <button @click="respondToQuote(order, 'accept')">
                  确认报价</button
                ><button
                  class="reject"
                  @click="respondToQuote(order, 'reject')"
                >
                  拒绝并沟通
                </button>
              </div>
            </div>
            <button
              v-if="
                ['APPOINTMENT_PENDING', 'APPOINTMENT_CONFIRMED'].includes(
                  order.status,
                )
              "
              class="cancel-button"
              @click="cancel(order)"
            >
              取消预约
            </button>
          </article>
        </div>
        <form
          v-else-if="view === 'booking'"
          class="booking-form"
          @submit.prevent="submitBooking"
        >
          <div class="choice-row">
            <button
              type="button"
              :class="{ active: booking.serviceMode === 'IN_STORE' }"
              @click="booking.serviceMode = 'IN_STORE'"
            >
              到店检测</button
            ><button
              type="button"
              :class="{ active: booking.serviceMode === 'ONSITE' }"
              @click="booking.serviceMode = 'ONSITE'"
            >
              上门维修
            </button>
          </div>
          <div class="form-grid">
            <label
              >设备类型<select v-model="booking.category">
                <option>笔记本电脑</option>
                <option>台式电脑</option>
                <option>手机</option>
                <option>平板电脑</option>
                <option>其他数码设备</option>
              </select></label
            >
            <label
              >品牌<input
                v-model.trim="booking.brand"
                placeholder="如 Apple、联想"
            /></label>
            <label class="full"
              >设备型号<input
                v-model.trim="booking.model"
                placeholder="如 MacBook Pro 14"
                required
            /></label>
            <label class="full"
              >故障现象<textarea
                v-model.trim="booking.problemDescription"
                minlength="5"
                placeholder="请描述故障发生时间、提示信息、是否进水或摔落……"
                required
              />
            </label>
            <label
              >预约日期<input
                v-model="booking.date"
                type="date"
                :min="minDate"
                required
            /></label>
            <label
              >开始时间<select v-model="booking.time">
                <option>09:00</option>
                <option>11:00</option>
                <option>14:00</option>
                <option>16:00</option>
                <option>19:00</option>
              </select></label
            >
            <template v-if="booking.serviceMode === 'ONSITE'"
              ><label
                >联系人<input
                  v-model.trim="booking.recipient"
                  required /></label
              ><label
                >联系电话<input
                  v-model.trim="booking.phone"
                  inputmode="tel"
                  required /></label
              ><label
                >省份<input v-model.trim="booking.province" required /></label
              ><label>城市<input v-model.trim="booking.city" required /></label
              ><label
                >区县<input v-model.trim="booking.district" required /></label
              ><label
                >详细地址<input v-model.trim="booking.detail" required /></label
            ></template>
          </div>
          <label class="consent"
            ><input
              v-model="booking.accepted"
              type="checkbox"
              required
            />我已阅读并同意维修服务条款与隐私说明</label
          >
          <button class="button" :disabled="submitting">
            {{ submitting ? "正在提交…" : "提交预约" }}
          </button>
        </form>
        <section v-else class="support-view">
          <form class="ticket-form" @submit.prevent="submitTicket">
            <h3>新建留言</h3>
            <div class="form-grid">
              <label class="full"
                >主题<input
                  v-model.trim="ticketForm.subject"
                  minlength="2"
                  required
              /></label>
              <label class="full"
                >关联订单<select v-model="ticketForm.orderId">
                  <option value="">不关联订单</option>
                  <option
                    v-for="order in orders"
                    :key="order.id"
                    :value="order.id"
                  >
                    {{ order.orderNo }} · {{ order.device?.model }}
                  </option>
                </select></label
              >
              <label class="full"
                >留言内容<textarea v-model.trim="ticketForm.body" required />
              </label>
            </div>
            <button class="button" :disabled="submitting">提交留言</button>
          </form>
          <div class="ticket-list">
            <article
              v-for="ticket in tickets"
              :key="ticket.id"
              class="ticket-card"
            >
              <div class="order-title">
                <div>
                  <strong>{{ ticket.subject }}</strong
                  ><small>{{ ticket.order?.orderNo || "未关联订单" }}</small>
                </div>
                <span class="status">{{ ticket.status }}</span>
              </div>
              <div class="messages">
                <div
                  v-for="message in ticket.messages"
                  :key="message.id"
                  :class="[
                    'ticket-message',
                    message.author.role === 'CUSTOMER'
                      ? 'mine'
                      : 'staff-message',
                  ]"
                >
                  <small>{{
                    message.author.role === "CUSTOMER"
                      ? "我"
                      : message.author.displayName || "客服"
                  }}</small>
                  <p>{{ message.body }}</p>
                </div>
              </div>
              <div
                v-if="!['RESOLVED', 'CLOSED'].includes(ticket.status)"
                class="reply-row"
              >
                <input
                  v-model="replyDrafts[ticket.id]"
                  placeholder="补充说明……"
                /><button @click="sendTicketReply(ticket.id)">发送</button
                ><button class="close-ticket" @click="finishTicket(ticket.id)">
                  结束
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>
      <form
        v-else
        class="auth-card"
        @submit.prevent="step === 'phone' ? sendCode() : signIn()"
      >
        <p class="eyebrow">CUSTOMER SIGN IN</p>
        <h2>手机号登录</h2>
        <p class="muted">登录后可预约维修、确认报价并查看服务进度。</p>
        <label
          >手机号<input
            v-model.trim="phone"
            inputmode="tel"
            maxlength="11"
            placeholder="请输入 11 位手机号"
            :disabled="step === 'code'"
            required
        /></label>
        <label v-if="step === 'code'"
          >验证码<input
            v-model.trim="code"
            inputmode="numeric"
            maxlength="6"
            autocomplete="one-time-code"
            placeholder="6 位验证码"
            required
        /></label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="button" :disabled="submitting">
          {{
            submitting ? "请稍候…" : step === "phone" ? "获取验证码" : "登录"
          }}
        </button>
        <button
          v-if="step === 'code'"
          class="text-button"
          type="button"
          @click="
            step = 'phone';
            code = '';
            error = '';
          "
        >
          更换手机号</button
        ><small>继续即表示你同意维修服务条款与隐私说明。</small>
      </form>
    </section>
  </main>
</template>
