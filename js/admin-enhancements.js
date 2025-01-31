// تهيئة المخططات البيانية
let requestsChart, departmentsChart;

function initCharts() {
    const requestsCtx = document.getElementById('requestsChart').getContext('2d');
    const departmentsCtx = document.getElementById('departmentsChart').getContext('2d');

    requestsChart = new Chart(requestsCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'الطلبات',
                data: [],
                borderColor: '#2c3e50',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            rtl: true,
            plugins: {
                title: {
                    display: true,
                    text: 'إحصائيات الطلبات'
                }
            }
        }
    });

    departmentsChart = new Chart(departmentsCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'الطلبات حسب القسم',
                data: [],
                backgroundColor: '#34495e'
            }]
        },
        options: {
            responsive: true,
            rtl: true,
            plugins: {
                title: {
                    display: true,
                    text: 'توزيع الطلبات حسب الأقسام'
                }
            }
        }
    });
}

// تحديث المخططات البيانية
async function updateCharts(period = 'daily') {
    const { data: requests, error } = await supabaseClient
        .from('requests')
        .select(`
            created_at,
            departments (name)
        `)
        .gte('created_at', getDateRange(period));

    if (error) {
        showNotification('error', 'حدث خطأ في تحميل البيانات');
        return;
    }

    // تحديث مخطط الطلبات
    const requestsByDate = groupBy(requests, r => 
        new Date(r.created_at).toLocaleDateString('ar-SA')
    );
    
    requestsChart.data.labels = Object.keys(requestsByDate);
    requestsChart.data.datasets[0].data = Object.values(requestsByDate).map(v => v.length);
    requestsChart.update();

    // تحديث مخطط الأقسام
    const requestsByDept = groupBy(requests, r => r.departments.name);
    
    departmentsChart.data.labels = Object.keys(requestsByDept);
    departmentsChart.data.datasets[0].data = Object.values(requestsByDept).map(v => v.length);
    departmentsChart.update();
}

// تصدير التقارير
async function exportReport(format) {
    const { data: requests, error } = await supabaseClient
        .from('requests')
        .select(`
            *,
            users (name),
            departments (name)
        `);

    if (error) {
        showNotification('error', 'حدث خطأ في تحميل البيانات');
        return;
    }

    if (format === 'pdf') {
        const doc = new jsPDF();
        doc.setFont('Cairo');
        doc.text('تقرير الطلبات', 10, 10);
        // إضافة البيانات للتقرير
        doc.save('تقرير_الطلبات.pdf');
    } else if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(requests);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'الطلبات');
        XLSX.writeFile(wb, 'تقرير_الطلبات.xlsx');
    }
}

// وظائف الأرشفة
async function archiveOldRequests() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: oldRequests, error } = await supabaseClient
        .from('requests')
        .select('*')
        .lt('created_at', sixMonthsAgo.toISOString());

    if (error) {
        showNotification('error', 'حدث خطأ في عملية الأرشفة');
        return;
    }

    // نقل الطلبات القديمة إلى جدول الأرشيف
    const { error: archiveError } = await supabaseClient
        .from('archived_requests')
        .insert(oldRequests);

    if (archiveError) {
        showNotification('error', 'حدث خطأ في حفظ الأرشيف');
        return;
    }

    // حذف الطلبات القديمة من الجدول الرئيسي
    await supabaseClient
        .from('requests')
        .delete()
        .lt('created_at', sixMonthsAgo.toISOString());

    showNotification('success', 'تم أرشفة الطلبات القديمة بنجاح');
}

// سجل العمليات
async function logAction(action, details) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    const { error } = await supabaseClient
        .from('audit_log')
        .insert([{
            user_id: user.id,
            action: action,
            details: details,
            ip_address: await getClientIP(),
            user_agent: navigator.userAgent
        }]);

    if (error) {
        console.error('خطأ في تسجيل العملية:', error);
    }
}

// نظام المحادثات
let chatSocket;

function initChat() {
    chatSocket = new WebSocket(CHAT_SERVER_URL);
    
    chatSocket.onmessage = function(event) {
        const message = JSON.parse(event.data);
        displayMessage(message);
    };

    chatSocket.onerror = function(error) {
        showNotification('error', 'حدث خطأ في الاتصال بخادم المحادثات');
    };
}

function sendMessage() {
    const input = document.querySelector('.chat-input input');
    const message = input.value.trim();
    
    if (!message) return;
    
    chatSocket.send(JSON.stringify({
        type: 'message',
        content: message
    }));
    
    input.value = '';
}

function startVideoCall() {
    // تنفيذ مكالمة فيديو باستخدام WebRTC
    const peerConnection = new RTCPeerConnection();
    // إعداد اتصال الفيديو
}

// الأتمتة والقواعد
async function createAutomationRule(rule) {
    const { error } = await supabaseClient
        .from('automation_rules')
        .insert([rule]);

    if (error) {
        showNotification('error', 'حدث خطأ في إنشاء القاعدة');
        return;
    }

    showNotification('success', 'تم إنشاء القاعدة بنجاح');
    loadAutomationRules();
}

async function processAutomationRules(request) {
    const { data: rules } = await supabaseClient
        .from('automation_rules')
        .select('*')
        .eq('active', true);

    for (const rule of rules) {
        if (evaluateRule(rule, request)) {
            await executeAction(rule.action, request);
        }
    }
}

// التحقق الثنائي
async function setup2FA() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    // إنشاء سر TOTP
    const secret = generateTOTPSecret();
    
    // حفظ السر في قاعدة البيانات
    await supabaseClient
        .from('user_2fa')
        .upsert([{
            user_id: user.id,
            secret: secret,
            enabled: true
        }]);

    // إنشاء رمز QR
    const qrCode = await generateQRCode(secret);
    
    return qrCode;
}

async function verify2FA(token) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    const { data: twoFA } = await supabaseClient
        .from('user_2fa')
        .select('secret')
        .eq('user_id', user.id)
        .single();

    return verifyTOTP(token, twoFA.secret);
}

// وظائف مساعدة
function getDateRange(period) {
    const now = new Date();
    switch (period) {
        case 'daily':
            return new Date(now.setDate(now.getDate() - 1)).toISOString();
        case 'weekly':
            return new Date(now.setDate(now.getDate() - 7)).toISOString();
        case 'monthly':
            return new Date(now.setMonth(now.getMonth() - 1)).toISOString();
        default:
            return new Date(now.setMonth(now.getMonth() - 1)).toISOString();
    }
}

function groupBy(array, key) {
    return array.reduce((result, item) => {
        const keyValue = typeof key === 'function' ? key(item) : item[key];
        (result[keyValue] = result[keyValue] || []).push(item);
        return result;
    }, {});
}

// تهيئة التحسينات
document.addEventListener('DOMContentLoaded', function() {
    initCharts();
    initChat();
    updateCharts();
    
    // إعداد مستمعي الأحداث
    document.getElementById('reportType').addEventListener('change', (e) => {
        updateCharts(e.target.value);
    });
    
    // جدولة المهام التلقائية
    setInterval(archiveOldRequests, 24 * 60 * 60 * 1000); // كل 24 ساعة
});
