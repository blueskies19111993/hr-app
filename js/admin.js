// تهيئة Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// التحقق من صلاحيات المدير
async function checkAdminAuth() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error || !user) {
        window.location.href = 'index.html';
        return;
    }

    const { data: adminData, error: adminError } = await supabaseClient
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    if (adminError || adminData?.role !== 'admin') {
        window.location.href = 'index.html';
    }
}

// تحميل البيانات الإحصائية
async function loadDashboardStats() {
    const [
        { count: employeesCount },
        { count: pendingCount },
        { count: departmentsCount },
        { count: totalRequestsCount }
    ] = await Promise.all([
        supabaseClient.from('users').select('*', { count: 'exact' }).eq('role', 'employee'),
        supabaseClient.from('requests').select('*', { count: 'exact' }).eq('status', 'pending'),
        supabaseClient.from('departments').select('*', { count: 'exact' }),
        supabaseClient.from('requests').select('*', { count: 'exact' })
    ]);

    document.getElementById('totalEmployees').textContent = employeesCount || 0;
    document.getElementById('pendingRequests').textContent = pendingCount || 0;
    document.getElementById('totalDepartments').textContent = departmentsCount || 0;
    document.getElementById('totalRequests').textContent = totalRequestsCount || 0;
}

// إدارة الموظفين
async function loadEmployees() {
    const { data: employees, error } = await supabaseClient
        .from('users')
        .select(`
            *,
            departments (name)
        `)
        .eq('role', 'employee');

    if (error) {
        showNotification('error', 'حدث خطأ في تحميل بيانات الموظفين');
        return;
    }

    const tbody = document.getElementById('employeesTableBody');
    tbody.innerHTML = '';

    employees.forEach(employee => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${employee.name}</td>
            <td>${employee.email}</td>
            <td>${employee.departments?.name || 'غير محدد'}</td>
            <td><span class="status-badge status-${employee.status}">${employee.status}</span></td>
            <td>${new Date(employee.created_at).toLocaleDateString('ar-SA')}</td>
            <td>
                <button onclick="editEmployee('${employee.id}')" class="action-btn">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteEmployee('${employee.id}')" class="action-btn delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// إدارة الأقسام
async function loadDepartments() {
    const { data: departments, error } = await supabaseClient
        .from('departments')
        .select(`
            *,
            users (id)
        `);

    if (error) {
        showNotification('error', 'حدث خطأ في تحميل بيانات الأقسام');
        return;
    }

    const grid = document.getElementById('departmentsGrid');
    grid.innerHTML = '';

    departments.forEach(dept => {
        const card = document.createElement('div');
        card.className = 'department-card';
        card.innerHTML = `
            <h3>${dept.name}</h3>
            <p>عدد الموظفين: ${dept.users?.length || 0}</p>
            <div class="card-actions">
                <button onclick="editDepartment('${dept.id}')" class="action-btn">
                    <i class="fas fa-edit"></i> تعديل
                </button>
                <button onclick="deleteDepartment('${dept.id}')" class="action-btn delete">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// إدارة أنواع الطلبات
async function loadRequestTypes() {
    const { data: types, error } = await supabaseClient
        .from('request_types')
        .select('*');

    if (error) {
        showNotification('error', 'حدث خطأ في تحميل أنواع الطلبات');
        return;
    }

    const container = document.getElementById('requestTypesContainer');
    container.innerHTML = '';

    types.forEach(type => {
        const card = document.createElement('div');
        card.className = 'request-type-card';
        card.innerHTML = `
            <h3>${type.name}</h3>
            <p>المرفقات المطلوبة:</p>
            <ul>
                ${type.required_attachments.map(att => `<li>${att}</li>`).join('')}
            </ul>
            <div class="card-actions">
                <button onclick="editRequestType('${type.id}')" class="action-btn">
                    <i class="fas fa-edit"></i> تعديل
                </button>
                <button onclick="deleteRequestType('${type.id}')" class="action-btn delete">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

// إدارة الطلبات
async function loadRequests() {
    const { data: requests, error } = await supabaseClient
        .from('requests')
        .select(`
            *,
            users (name),
            request_types (name)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        showNotification('error', 'حدث خطأ في تحميل الطلبات');
        return;
    }

    const tbody = document.getElementById('requestsTableBody');
    tbody.innerHTML = '';

    requests.forEach(request => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${request.id}</td>
            <td>${request.request_types.name}</td>
            <td>${request.users.name}</td>
            <td>${new Date(request.created_at).toLocaleDateString('ar-SA')}</td>
            <td><span class="status-badge status-${request.status}">${request.status}</span></td>
            <td>
                <button onclick="viewRequest('${request.id}')" class="action-btn">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="updateRequestStatus('${request.id}', 'approved')" class="action-btn approve">
                    <i class="fas fa-check"></i>
                </button>
                <button onclick="updateRequestStatus('${request.id}', 'rejected')" class="action-btn reject">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// إضافة موظف جديد
async function addEmployee(formData) {
    const { data, error } = await supabaseClient.auth.signUp({
        email: formData.email,
        password: formData.password,
    });

    if (error) {
        showNotification('error', 'حدث خطأ في إنشاء حساب الموظف');
        return;
    }

    const { error: profileError } = await supabaseClient
        .from('users')
        .insert([{
            id: data.user.id,
            name: formData.name,
            email: formData.email,
            department_id: formData.department,
            role: 'employee',
            status: 'active'
        }]);

    if (profileError) {
        showNotification('error', 'حدث خطأ في إضافة بيانات الموظف');
        return;
    }

    showNotification('success', 'تم إضافة الموظف بنجاح');
    loadEmployees();
}

// حذف موظف
async function deleteEmployee(employeeId) {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟')) return;

    const { error } = await supabaseClient
        .from('users')
        .delete()
        .eq('id', employeeId);

    if (error) {
        showNotification('error', 'حدث خطأ في حذف الموظف');
        return;
    }

    showNotification('success', 'تم حذف الموظف بنجاح');
    loadEmployees();
}

// إضافة قسم جديد
async function addDepartment(formData) {
    const { error } = await supabaseClient
        .from('departments')
        .insert([{
            name: formData.name,
            description: formData.description
        }]);

    if (error) {
        showNotification('error', 'حدث خطأ في إضافة القسم');
        return;
    }

    showNotification('success', 'تم إضافة القسم بنجاح');
    loadDepartments();
}

// حذف قسم
async function deleteDepartment(departmentId) {
    if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) return;

    const { error } = await supabaseClient
        .from('departments')
        .delete()
        .eq('id', departmentId);

    if (error) {
        showNotification('error', 'حدث خطأ في حذف القسم');
        return;
    }

    showNotification('success', 'تم حذف القسم بنجاح');
    loadDepartments();
}

// إضافة نوع طلب جديد
async function addRequestType(formData) {
    const { error } = await supabaseClient
        .from('request_types')
        .insert([{
            name: formData.name,
            description: formData.description,
            required_attachments: formData.attachments
        }]);

    if (error) {
        showNotification('error', 'حدث خطأ في إضافة نوع الطلب');
        return;
    }

    showNotification('success', 'تم إضافة نوع الطلب بنجاح');
    loadRequestTypes();
}

// حذف نوع طلب
async function deleteRequestType(typeId) {
    if (!confirm('هل أنت متأكد من حذف هذا النوع من الطلبات؟')) return;

    const { error } = await supabaseClient
        .from('request_types')
        .delete()
        .eq('id', typeId);

    if (error) {
        showNotification('error', 'حدث خطأ في حذف نوع الطلب');
        return;
    }

    showNotification('success', 'تم حذف نوع الطلب بنجاح');
    loadRequestTypes();
}

// تحديث حالة الطلب
async function updateRequestStatus(requestId, status) {
    const { error } = await supabaseClient
        .from('requests')
        .update({ status: status })
        .eq('id', requestId);

    if (error) {
        showNotification('error', 'حدث خطأ في تحديث حالة الطلب');
        return;
    }

    showNotification('success', 'تم تحديث حالة الطلب بنجاح');
    loadRequests();
}

// حفظ الإعدادات
async function saveSettings() {
    const settings = {
        max_attachment_size: document.getElementById('maxAttachmentSize').value,
        max_attachments: document.getElementById('maxAttachments').value,
        allowed_file_types: Array.from(document.querySelectorAll('.checkbox-group input:checked')).map(cb => cb.value)
    };

    const { error } = await supabaseClient
        .from('settings')
        .upsert([settings]);

    if (error) {
        showNotification('error', 'حدث خطأ في حفظ الإعدادات');
        return;
    }

    showNotification('success', 'تم حفظ الإعدادات بنجاح');
}

// إظهار النوافذ المنبثقة
function showModal(type) {
    const modal = document.getElementById('modal');
    modal.style.display = 'flex';
    
    switch(type) {
        case 'addEmployee':
            modal.querySelector('.modal-content').innerHTML = `
                <div class="modal-header">
                    <h3>إضافة موظف جديد</h3>
                    <button onclick="closeModal()" class="close-btn">×</button>
                </div>
                <div class="modal-body">
                    <form id="addEmployeeForm" onsubmit="handleAddEmployee(event)">
                        <div class="form-group">
                            <label>الاسم</label>
                            <input type="text" name="name" required>
                        </div>
                        <div class="form-group">
                            <label>البريد الإلكتروني</label>
                            <input type="email" name="email" required>
                        </div>
                        <div class="form-group">
                            <label>كلمة المرور</label>
                            <input type="password" name="password" required>
                        </div>
                        <div class="form-group">
                            <label>القسم</label>
                            <select name="department" required>
                                <!-- سيتم ملؤها ديناميكياً -->
                            </select>
                        </div>
                        <button type="submit" class="submit-btn">إضافة</button>
                    </form>
                </div>
            `;
            loadDepartmentsForSelect();
            break;
        // أضف المزيد من الحالات حسب الحاجة
    }
}

// تحميل الأقسام للقائمة المنسدلة
async function loadDepartmentsForSelect() {
    const { data: departments, error } = await supabaseClient
        .from('departments')
        .select('id, name');

    if (error) return;

    const select = document.querySelector('select[name="department"]');
    select.innerHTML = departments.map(dept => 
        `<option value="${dept.id}">${dept.name}</option>`
    ).join('');
}

// إغلاق النافذة المنبثقة
function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// عرض الإشعارات
function showNotification(type, message) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// تبديل بين الأقسام
function showSection(sectionId) {
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
    
    // تحديث القائمة الجانبية
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.classList.remove('active');
    });
    document.querySelector(`[href="#${sectionId}"]`).parentElement.classList.add('active');
}

// تسجيل الخروج
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
});

// تحميل البيانات عند تحميل الصفحة
window.addEventListener('load', async () => {
    await checkAdminAuth();
    await loadDashboardStats();
    await loadEmployees();
    await loadDepartments();
    await loadRequestTypes();
    await loadRequests();
});
