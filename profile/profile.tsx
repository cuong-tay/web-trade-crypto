// Profile Page Logic

// Edit Personal Information
let isEditing = false;

const toggleEditPersonal = () => {
    isEditing = !isEditing;
    
    const inputs = ['fullname', 'email', 'phone', 'birthdate', 'country'];
    const editBtn = document.getElementById('edit-personal-btn');
    const actions = document.getElementById('personal-actions');
    
    inputs.forEach(id => {
        const input = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
        if (input) {
            input.disabled = !isEditing;
        }
    });
    
    if (editBtn && actions) {
        if (isEditing) {
            editBtn.style.display = 'none';
            actions.style.display = 'flex';
        } else {
            editBtn.style.display = 'inline-flex';
            actions.style.display = 'none';
        }
    }
};

const savePersonalInfo = () => {
    // Get values
    const fullname = (document.getElementById('fullname') as HTMLInputElement).value;
    const email = (document.getElementById('email') as HTMLInputElement).value;
    const phone = (document.getElementById('phone') as HTMLInputElement).value;
    const birthdate = (document.getElementById('birthdate') as HTMLInputElement).value;
    const country = (document.getElementById('country') as HTMLSelectElement).value;
    
    console.log('Saving personal info:', { fullname, email, phone, birthdate, country });
    
    // TODO: Send to server/database
    
    // Show success message
    alert('Thông tin đã được cập nhật thành công!');
    
    // Exit edit mode
    toggleEditPersonal();
};

const cancelEdit = () => {
    // TODO: Restore original values
    toggleEditPersonal();
};

// Dark Mode Toggle
const toggleDarkMode = (enabled: boolean) => {
    console.log('Dark mode:', enabled ? 'enabled' : 'disabled');
    // TODO: Implement dark mode
    if (enabled) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
};

// Avatar Upload
const handleAvatarChange = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const avatars = document.querySelectorAll('.profile-avatar, .user-profile img');
                avatars.forEach(avatar => {
                    (avatar as HTMLImageElement).src = event.target?.result as string;
                });
            };
            reader.readAsDataURL(file);
            console.log('Avatar uploaded:', file.name);
        }
    };
    
    input.click();
};

// Cover Upload
const handleCoverChange = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const cover = document.querySelector('.profile-cover') as HTMLElement;
                if (cover) {
                    cover.style.backgroundImage = `url(${event.target?.result})`;
                    cover.style.backgroundSize = 'cover';
                    cover.style.backgroundPosition = 'center';
                }
            };
            reader.readAsDataURL(file);
            console.log('Cover uploaded:', file.name);
        }
    };
    
    input.click();
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Profile page initialized');
    
    // Personal info edit
    const editBtn = document.getElementById('edit-personal-btn');
    const saveBtn = document.getElementById('save-personal-btn');
    const cancelBtn = document.getElementById('cancel-personal-btn');
    
    editBtn?.addEventListener('click', toggleEditPersonal);
    saveBtn?.addEventListener('click', savePersonalInfo);
    cancelBtn?.addEventListener('click', cancelEdit);
    
    // Dark mode toggle
    const darkModeToggle = document.getElementById('dark-mode-toggle') as HTMLInputElement;
    darkModeToggle?.addEventListener('change', (e) => {
        toggleDarkMode((e.target as HTMLInputElement).checked);
    });
    
    // Avatar and cover upload
    const editAvatarBtn = document.querySelector('.btn-edit-avatar');
    const editCoverBtn = document.querySelector('.btn-edit-cover');
    
    editAvatarBtn?.addEventListener('click', handleAvatarChange);
    editCoverBtn?.addEventListener('click', handleCoverChange);
    
    // Security items
    const securityItems = document.querySelectorAll('.security-item .btn-link');
    securityItems.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const parent = (btn as HTMLElement).closest('.security-item');
            const title = parent?.querySelector('h4')?.textContent;
            alert(`Chức năng "${title}" sẽ được cập nhật sau`);
        });
    });
    
    // Verification items
    const verificationBtns = document.querySelectorAll('.verification-item .btn-link');
    verificationBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Chức năng xác minh KYC Level 2 sẽ được cập nhật sau');
        });
    });
    
    // Notification toggles
    const notificationToggles = document.querySelectorAll('.preference-item input[type="checkbox"]');
    notificationToggles.forEach(toggle => {
        if (toggle.id !== 'dark-mode-toggle') {
            toggle.addEventListener('change', (e) => {
                const checked = (e.target as HTMLInputElement).checked;
                const parent = (toggle as HTMLElement).closest('.preference-item');
                const title = parent?.querySelector('h4')?.textContent;
                console.log(`${title}: ${checked ? 'Bật' : 'Tắt'}`);
            });
        }
    });
    
    // Language and currency selects
    const selects = document.querySelectorAll('.form-select-sm');
    selects.forEach(select => {
        select.addEventListener('change', (e) => {
            const value = (e.target as HTMLSelectElement).value;
            const parent = (select as HTMLElement).closest('.preference-item');
            const title = parent?.querySelector('h4')?.textContent;
            console.log(`${title} changed to: ${value}`);
        });
    });
});
