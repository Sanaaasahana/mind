// Utility functions
function getCurrentUser() {
  const user = localStorage.getItem("mindful_current_user");
  return user ? JSON.parse(user) : null;
}

function autoLoginForDev() {
  // Auto-login a test user if no current user (for dev only)
  if (!localStorage.getItem("mindful_current_user")) {
    const devUser = {
      id: 1,
      name: "Sarah Johnson",
      email: "sarah@example.com"
    };
    localStorage.setItem("mindful_current_user", JSON.stringify(devUser));
    console.warn("Auto-login test user for development.");
  }
}

function checkAuth() {
  autoLoginForDev(); // Only for dev mode — remove in production
  const currentUser = getCurrentUser();
  if (!currentUser) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

function logout() {
  if (confirm("Are you sure you want to logout?")) {
    localStorage.removeItem("mindful_current_user");
    window.location.href = "login.html";
  }
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span>${message}</span>
      <button onclick="this.parentElement.parentElement.remove()" class="notification-close">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;

  if (!document.getElementById("notification-styles")) {
    const styles = document.createElement("style");
    styles.id = "notification-styles";
    styles.textContent = `
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
        padding: 15px 20px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(10px);
        animation: slideInRight 0.3s ease-out;
      }

      .notification.success {
        background: rgba(40, 167, 69, 0.95);
        color: white;
        border: 1px solid rgba(40, 167, 69, 0.3);
      }

      .notification.error {
        background: rgba(220, 53, 69, 0.95);
        color: white;
        border: 1px solid rgba(220, 53, 69, 0.3);
      }

      .notification.info {
        background: rgba(23, 162, 184, 0.95);
        color: white;
        border: 1px solid rgba(23, 162, 184, 0.3);
      }

      .notification-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
      }

      .notification-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 5px;
        border-radius: 50%;
        transition: all 0.3s ease;
      }

      .notification-close:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(styles);
  }

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// Initialize sample data if none exists
function initializeSampleData() {
  const users = JSON.parse(localStorage.getItem("mindful_users")) || [];

  if (users.length === 0) {
    const sampleUsers = [
      {
        id: 1,
        name: "Sarah Johnson",
        email: "sarah@example.com",
        password: "password123",
        age: 28,
        gender: "female",
        bio: "Mental health advocate and yoga enthusiast. Finding peace in mindfulness.",
        joinDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        profileComplete: true,
      },
      {
        id: 2,
        name: "Michael Chen",
        email: "michael@example.com",
        password: "password123",
        age: 34,
        gender: "male",
        bio: "Meditation practitioner and wellness coach. Here to support and grow.",
        joinDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        profileComplete: true,
      },
      {
        id: 3,
        name: "Emma Rodriguez",
        email: "emma@example.com",
        password: "password123",
        age: 25,
        gender: "female",
        bio: "Art therapy student learning to heal through creativity and community.",
        joinDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        profileComplete: true,
      },
    ];

    localStorage.setItem("mindful_users", JSON.stringify(sampleUsers));

    const sampleEntries = [
      {
        id: Date.now() + 1,
        userId: 1,
        userName: "Sarah Johnson",
        content:
          "Today I practiced gratitude meditation for 20 minutes. It helped me center myself and appreciate the small moments of joy in my day. The morning sunlight through my window felt like a warm hug.",
        category: "mindfulness",
        isPublic: true,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: Date.now() + 2,
        userId: 2,
        userName: "Michael Chen",
        content:
          "Dealing with work stress has been challenging lately. I've been using breathing exercises and they really help. Remember: this too shall pass. Taking it one day at a time.",
        category: "stress",
        isPublic: true,
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: Date.now() + 3,
        userId: 3,
        userName: "Emma Rodriguez",
        content:
          "Art therapy session today was incredible. I painted my emotions and it felt so liberating. Colors have a way of expressing what words cannot. Feeling grateful for this healing journey.",
        category: "personal-growth",
        isPublic: true,
        timestamp: new Date().toISOString(),
      },
    ];

    localStorage.setItem("mindful_journal", JSON.stringify(sampleEntries));
  }
}

// Call initialization when script loads
initializeSampleData();

// Export functions globally
window.getCurrentUser = getCurrentUser;
window.checkAuth = checkAuth;
window.logout = logout;
window.showNotification = showNotification;
