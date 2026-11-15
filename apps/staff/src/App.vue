<script setup lang="ts">
import type {
  AuthUser,
  RepairOrder,
  RepairOrderStatus,
  StaffAccount,
  StoreRecord,
  SupportTicket,
} from "@ironcode/contracts";
import { onMounted, reactive, ref } from "vue";
import {
  assignEngineer,
  closeStaffTicket,
  createEngineer,
  listStaffOrders,
  listStaffAccounts,
  listStaffTickets,
  listStores,
  logout,
  recordInStorePayment,
  refreshSession,
  replyStaffTicket,
  staffLogin,
  submitInspection,
  transitionOrder,
  updateStaffAccount,
  updateStore,
  uploadInspectionPhoto,
} from "./api";

const username = ref("");
const password = ref("");
const user = ref<AuthUser | null>(null);
const orders = ref<RepairOrder[]>([]);
const staffAccounts = ref<StaffAccount[]>([]);
const stores = ref<StoreRecord[]>([]);
const tickets = ref<SupportTicket[]>([]);
const view = ref<"orders" | "tickets" | "admin">("orders");
const loading = ref(true);
const submitting = ref(false);
const error = ref("");
const inspectionOrder = ref<RepairOrder | null>(null);
const inspectionPhoto = ref<File | null>(null);
const inspection = reactive({
  cause: "",
  solution: "",
  notes: "",
  itemName: "维修服务",
  priceYuan: 0,
});
const engineerForm = reactive({
  username: "",
  password: "",
  displayName: "",
  storeId: "",
  title: "维修工程师",
});
const storeForm = reactive({ name: "", address: "", phone: "" });
const replyDrafts = reactive<Record<string, string>>({});

const statusNames: Record<RepairOrderStatus, string> = {
  APPOINTMENT_PENDING: "预约待确认",
  APPOINTMENT_CONFIRMED: "预约已确认",
  RECEIVED: "设备已接收",
  DIAGNOSING: "检测中",
  QUOTE_PENDING_CUSTOMER: "待客户确认报价",
  QUOTE_REJECTED: "报价已拒绝",
  WAITING_REPAIR: "待维修",
  REPAIRING: "维修中",
  TESTING: "测试中",
  READY_FOR_DELIVERY: "待交付",
  COMPLETED: "已完成",
  CANCELED: "已取消",
  WARRANTY_RETURN: "质保返修",
};
const nextStatus: Partial<
  Record<RepairOrderStatus, { status: RepairOrderStatus; label: string }>
> = {
  APPOINTMENT_PENDING: { status: "APPOINTMENT_CONFIRMED", label: "确认预约" },
  APPOINTMENT_CONFIRMED: { status: "RECEIVED", label: "确认已接收" },
  RECEIVED: { status: "DIAGNOSING", label: "开始检测" },
  WAITING_REPAIR: { status: "REPAIRING", label: "开始维修" },
  REPAIRING: { status: "TESTING", label: "进入测试" },
  TESTING: { status: "READY_FOR_DELIVERY", label: "标记待交付" },
  READY_FOR_DELIVERY: { status: "COMPLETED", label: "确认已完成" },
  WARRANTY_RETURN: { status: "DIAGNOSING", label: "开始返修检测" },
};

onMounted(async () => {
  try {
    const result = await refreshSession();
    if (result.user.role !== "CUSTOMER") {
      user.value = result.user;
      await loadWorkspace();
    }
  } catch {
    /* Signed out is expected. */
  } finally {
    loading.value = false;
  }
});
async function loadOrders() {
  orders.value = await listStaffOrders();
}
async function loadWorkspace() {
  await Promise.all([loadOrders(), loadTickets()]);
  if (user.value?.role === "ADMIN") {
    [staffAccounts.value, stores.value] = await Promise.all([
      listStaffAccounts(),
      listStores(),
    ]);
    if (stores.value[0]) {
      engineerForm.storeId ||= stores.value[0].id;
      storeForm.name = stores.value[0].name;
      storeForm.address = stores.value[0].address || "";
      storeForm.phone = stores.value[0].phone || "";
    }
  }
}
async function loadTickets() {
  tickets.value = await listStaffTickets();
}
async function signIn() {
  error.value = "";
  submitting.value = true;
  try {
    user.value = (await staffLogin(username.value, password.value)).user;
    await loadWorkspace();
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
  staffAccounts.value = [];
  stores.value = [];
  tickets.value = [];
  password.value = "";
}
async function advance(order: RepairOrder) {
  const next = nextStatus[order.status];
  if (!next) return;
  error.value = "";
  try {
    await transitionOrder(order.id, next.status, order.version);
    await loadOrders();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "状态更新失败";
  }
}
async function payInStore(order: RepairOrder) {
  if (!window.confirm("确认已经收到该订单的到店付款？")) return;
  try {
    await recordInStorePayment(order.id);
    await loadOrders();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "付款登记失败";
  }
}
async function assign(order: RepairOrder, event: Event) {
  const engineerId = (event.target as HTMLSelectElement).value;
  if (!engineerId) return;
  try {
    await assignEngineer(order.id, engineerId, order.version);
    await loadOrders();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "工程师分配失败";
  }
}
function hasPaid(order: RepairOrder) {
  return order.payments.some((payment) => payment.status === "SUCCEEDED");
}
function canAdvance(order: RepairOrder) {
  if (order.status !== "WAITING_REPAIR") return true;
  const acceptedQuote = order.quotes.find(
    (quote) => quote.status === "ACCEPTED",
  );
  return !acceptedQuote || Number(acceptedQuote.total) <= 0 || hasPaid(order);
}
async function saveInspection() {
  if (!inspectionOrder.value) return;
  error.value = "";
  submitting.value = true;
  try {
    if (inspectionPhoto.value)
      await uploadInspectionPhoto(
        inspectionOrder.value.id,
        inspectionPhoto.value,
      );
    await submitInspection(inspectionOrder.value.id, {
      cause: inspection.cause,
      solution: inspection.solution,
      ...(inspection.notes ? { notes: inspection.notes } : {}),
      expectedVersion: inspectionOrder.value.version,
      items: [
        {
          name: inspection.itemName,
          quantity: 1,
          unitPriceFen: Math.round(inspection.priceYuan * 100),
        },
      ],
    });
    inspectionOrder.value = null;
    inspectionPhoto.value = null;
    inspection.cause = "";
    inspection.solution = "";
    inspection.notes = "";
    inspection.priceYuan = 0;
    await loadOrders();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "检测报告提交失败";
  } finally {
    submitting.value = false;
  }
}
function selectPhoto(event: Event) {
  inspectionPhoto.value = (event.target as HTMLInputElement).files?.[0] || null;
}
async function addEngineer() {
  error.value = "";
  submitting.value = true;
  try {
    await createEngineer({ ...engineerForm });
    engineerForm.username = "";
    engineerForm.password = "";
    engineerForm.displayName = "";
    staffAccounts.value = await listStaffAccounts();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "员工创建失败";
  } finally {
    submitting.value = false;
  }
}
async function toggleStaff(staff: StaffAccount) {
  await updateStaffAccount(staff.id, {
    status: staff.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
  });
  staffAccounts.value = await listStaffAccounts();
}
async function saveStore() {
  const store = stores.value[0];
  if (!store) return;
  await updateStore(store.id, {
    name: storeForm.name,
    ...(storeForm.address ? { address: storeForm.address } : {}),
    ...(storeForm.phone ? { phone: storeForm.phone } : {}),
  });
  stores.value = await listStores();
}
async function sendTicketReply(ticketId: string) {
  const body = replyDrafts[ticketId]?.trim();
  if (!body) return;
  await replyStaffTicket(ticketId, body);
  replyDrafts[ticketId] = "";
  await loadTickets();
}
async function finishTicket(ticketId: string) {
  await closeStaffTicket(ticketId);
  await loadTickets();
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
  <main class="page" :class="{ signed: user }">
    <aside class="side">
      <div class="brand">
        <span>铁</span>
        <div><strong>铁码维修</strong><small>STAFF CONSOLE</small></div>
      </div>
      <div class="side-copy">
        <p>内部工作台</p>
        <h1>让每一次维修，<br />都有清晰记录。</h1>
      </div>
      <small>仅限授权员工使用 · 所有关键操作均记录审计日志</small>
    </aside>
    <section class="content">
      <div v-if="loading" class="card">正在检查登录状态…</div>
      <div v-else-if="user" class="card dashboard">
        <header class="dashboard-head">
          <div>
            <p class="eyebrow">STAFF CONSOLE</p>
            <h2>
              {{
                view === "orders"
                  ? "维修工作台"
                  : view === "tickets"
                    ? "服务留言"
                    : "门店与员工"
              }}
            </h2>
            <p class="muted">
              {{ user.displayName || user.username }} ·
              {{ user.role === "ADMIN" ? "管理员" : "工程师" }}
            </p>
          </div>
          <div class="header-actions">
            <button class="link-button" @click="view = 'orders'">订单</button>
            <button class="link-button" @click="view = 'tickets'">留言</button>
            <button
              v-if="user.role === 'ADMIN'"
              class="link-button"
              @click="view = 'admin'"
            >
              管理
            </button>
            <button class="link-button muted" @click="signOut">退出</button>
          </div>
        </header>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <template v-if="view === 'orders'">
          <div class="metric-grid">
            <div>
              <strong>{{
                orders.filter((item) => item.status === "APPOINTMENT_PENDING")
                  .length
              }}</strong
              ><span>待确认预约</span>
            </div>
            <div>
              <strong>{{
                orders.filter((item) =>
                  ["RECEIVED", "DIAGNOSING", "REPAIRING", "TESTING"].includes(
                    item.status,
                  ),
                ).length
              }}</strong
              ><span>处理中</span>
            </div>
            <div>
              <strong>{{
                orders.filter((item) => item.status === "READY_FOR_DELIVERY")
                  .length
              }}</strong
              ><span>待交付</span>
            </div>
          </div>
          <div class="queue">
            <div v-if="!orders.length" class="empty">
              当前没有分配给你的订单。
            </div>
            <article v-for="order in orders" :key="order.id" class="task">
              <div class="task-head">
                <div>
                  <strong
                    >{{ order.device?.brand }} {{ order.device?.model }}</strong
                  ><small>{{ order.orderNo }}</small>
                </div>
                <span class="status">{{ statusNames[order.status] }}</span>
              </div>
              <p>{{ order.problemDescription }}</p>
              <div class="task-meta">
                <span>{{
                  order.serviceMode === "ONSITE" ? "上门维修" : "到店检测"
                }}</span
                ><span>{{ formatDate(order.scheduledStart) }}</span
                ><span v-if="order.assignedEngineer"
                  >工程师：{{
                    order.assignedEngineer.displayName ||
                    order.assignedEngineer.id
                  }}</span
                >
              </div>
              <label v-if="user.role === 'ADMIN'" class="assign-row"
                >分配工程师<select
                  :value="order.assignedEngineer?.id || ''"
                  @change="assign(order, $event)"
                >
                  <option value="">暂不分配</option>
                  <option
                    v-for="staff in staffAccounts.filter(
                      (item) =>
                        item.role === 'ENGINEER' && item.status === 'ACTIVE',
                    )"
                    :key="staff.id"
                    :value="staff.id"
                  >
                    {{ staff.displayName || staff.username }}
                  </option>
                </select></label
              >
              <button
                v-if="
                  order.status === 'WAITING_REPAIR' &&
                  user.role === 'ADMIN' &&
                  !hasPaid(order)
                "
                class="action payment-action"
                @click="payInStore(order)"
              >
                登记到店付款
              </button>
              <button
                v-if="nextStatus[order.status] && canAdvance(order)"
                class="action"
                @click="advance(order)"
              >
                {{ nextStatus[order.status]?.label }}
              </button>
              <button
                v-else-if="order.status === 'DIAGNOSING'"
                class="action"
                @click="inspectionOrder = order"
              >
                填写检测报告与报价
              </button>
              <span
                v-else-if="order.status === 'QUOTE_PENDING_CUSTOMER'"
                class="hint"
                >等待客户确认报价</span
              >
            </article>
          </div>
        </template>
        <section v-else-if="view === 'tickets'" class="ticket-queue">
          <div v-if="!tickets.length" class="empty">当前没有服务留言。</div>
          <article
            v-for="ticket in tickets"
            :key="ticket.id"
            class="task ticket-task"
          >
            <div class="task-head">
              <div>
                <strong>{{ ticket.subject }}</strong
                ><small
                  >{{
                    ticket.createdBy.phone || ticket.createdBy.displayName
                  }}
                  · {{ ticket.order?.orderNo || "未关联订单" }}</small
                >
              </div>
              <span class="status">{{ ticket.status }}</span>
            </div>
            <div class="staff-messages">
              <div
                v-for="message in ticket.messages"
                :key="message.id"
                :class="[
                  'staff-message',
                  message.author.role !== 'CUSTOMER' ? 'mine' : '',
                ]"
              >
                <small>{{
                  message.author.role === "CUSTOMER"
                    ? "客户"
                    : message.author.displayName || message.author.username
                }}</small>
                <p>{{ message.body }}</p>
              </div>
            </div>
            <div
              v-if="!['RESOLVED', 'CLOSED'].includes(ticket.status)"
              class="staff-reply"
            >
              <input
                v-model="replyDrafts[ticket.id]"
                placeholder="回复客户……"
              /><button @click="sendTicketReply(ticket.id)">回复</button
              ><button class="close-reply" @click="finishTicket(ticket.id)">
                关闭
              </button>
            </div>
          </article>
        </section>
        <section v-else-if="user.role === 'ADMIN'" class="admin-grid">
          <form class="admin-panel" @submit.prevent="addEngineer">
            <h3>新增工程师</h3>
            <label
              >登录账号<input
                v-model.trim="engineerForm.username"
                minlength="3"
                required /></label
            ><label
              >显示姓名<input
                v-model.trim="engineerForm.displayName"
                required /></label
            ><label
              >初始密码<input
                v-model="engineerForm.password"
                type="password"
                minlength="12"
                required /></label
            ><label
              >所属门店<select v-model="engineerForm.storeId">
                <option
                  v-for="store in stores"
                  :key="store.id"
                  :value="store.id"
                >
                  {{ store.name }}
                </option>
              </select></label
            ><label>岗位名称<input v-model.trim="engineerForm.title" /></label
            ><button class="button" :disabled="submitting">创建工程师</button>
          </form>
          <form class="admin-panel" @submit.prevent="saveStore">
            <h3>门店资料</h3>
            <label
              >门店名称<input v-model.trim="storeForm.name" required /></label
            ><label>门店地址<input v-model.trim="storeForm.address" /></label
            ><label>联系电话<input v-model.trim="storeForm.phone" /></label
            ><button class="button">保存门店资料</button>
          </form>
          <div class="admin-panel staff-list">
            <h3>员工账号</h3>
            <div
              v-for="staff in staffAccounts"
              :key="staff.id"
              class="staff-row"
            >
              <div>
                <strong>{{ staff.displayName || staff.username }}</strong
                ><small
                  >{{ staff.role }} ·
                  {{
                    staff.storeMemberships[0]?.store.name || "系统管理员"
                  }}</small
                >
              </div>
              <button
                v-if="staff.id !== user.id"
                :class="{ danger: staff.status === 'ACTIVE' }"
                @click="toggleStaff(staff)"
              >
                {{ staff.status === "ACTIVE" ? "停用" : "启用" }}
              </button>
            </div>
          </div>
        </section>
        <div
          v-if="inspectionOrder"
          class="modal-backdrop"
          @click.self="inspectionOrder = null"
        >
          <form class="inspection-modal" @submit.prevent="saveInspection">
            <div class="modal-head">
              <div>
                <p class="eyebrow">INSPECTION</p>
                <h3>检测报告与报价</h3>
              </div>
              <button type="button" @click="inspectionOrder = null">×</button>
            </div>
            <label
              >故障原因<textarea
                v-model.trim="inspection.cause"
                minlength="5"
                required
              /></label
            ><label
              >维修方案<textarea
                v-model.trim="inspection.solution"
                minlength="5"
                required
              /></label
            ><label
              >报价项目<input
                v-model.trim="inspection.itemName"
                required /></label
            ><label
              >报价金额（元）<input
                v-model.number="inspection.priceYuan"
                type="number"
                min="0"
                step="0.01"
                required /></label
            ><label>补充说明<textarea v-model.trim="inspection.notes" /></label
            ><label
              >检测照片（可选，上传至私有 R2）<input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                @change="selectPhoto" /></label
            ><button class="button" :disabled="submitting">
              {{ submitting ? "正在提交…" : "提交给客户确认" }}
            </button>
          </form>
        </div>
      </div>
      <form v-else class="card" @submit.prevent="signIn">
        <p class="eyebrow">SECURE ACCESS</p>
        <h2>员工登录</h2>
        <p class="muted">请使用管理员分配的内部账号。</p>
        <label
          >账号<input
            v-model.trim="username"
            autocomplete="username"
            minlength="3"
            required
        /></label>
        <label
          >密码<input
            v-model="password"
            type="password"
            autocomplete="current-password"
            minlength="10"
            required
        /></label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="button" :disabled="submitting">
          {{ submitting ? "正在验证…" : "进入工作台" }}
        </button>
      </form>
    </section>
  </main>
</template>
