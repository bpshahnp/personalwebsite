const SCHOOL_INFO = {
    name: "OM SHANTI ACADEMY",
    tagline: "An activity based school",
    logoPath: "abc.png",
    competitionTitle: "Inter-House Quiz Competition - 2083"
};

// Load saved competition title from localStorage
function loadCompetitionTitle() {
    const saved = localStorage.getItem('competitionTitle');
    if (saved) {
        SCHOOL_INFO.competitionTitle = saved;
    }
}

function loadCommonHeader() {
    loadCompetitionTitle();
    
    const headers = document.querySelectorAll('.header');
    headers.forEach(header => {
        // Update school name
        const schoolName = header.querySelector('.school-info h1');
        if (schoolName) schoolName.textContent = SCHOOL_INFO.name;
        
        // Update tagline
        const tagline = header.querySelector('.school-tagline');
        if (tagline) tagline.textContent = SCHOOL_INFO.tagline;
        
        // Update logo
        const logo = header.querySelector('.school-logo img');
        if (logo) logo.src = SCHOOL_INFO.logoPath;
        
        // Update competition title
        const compTitle = header.querySelector('.competition-title, .competition-title-main');
        if (compTitle) compTitle.textContent = SCHOOL_INFO.competitionTitle;
    });
}

// Update competition title and save to localStorage
function updateCompetitionTitle(newTitle) {
    if (!newTitle || newTitle.trim() === '') {
        alert('Competition name cannot be empty');
        return false;
    }
    
    SCHOOL_INFO.competitionTitle = newTitle.trim();
    localStorage.setItem('competitionTitle', SCHOOL_INFO.competitionTitle);
    loadCommonHeader();
    closeCompetitionModal();
    return true;
}

// Modal Functions
function openCompetitionModal() {
    const modal = document.getElementById('competitionModal');
    if (modal) {
        modal.style.display = 'flex';
        const input = document.getElementById('competitionInput');
        if (input) {
            input.value = SCHOOL_INFO.competitionTitle;
            input.focus();
            input.select();
        }
    }
}

function closeCompetitionModal() {
    const modal = document.getElementById('competitionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Event listeners for modal
function setupCompetitionModal() {
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCompetitionModal();
        }
    });
    
    // Close on outside click
    const modal = document.getElementById('competitionModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCompetitionModal();
            }
        });
    }
    
    // Save button handler
    const saveBtn = document.getElementById('saveCompetitionBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const input = document.getElementById('competitionInput');
            if (input) {
                updateCompetitionTitle(input.value);
            }
        });
    }
    
    // Enter key to save
    const input = document.getElementById('competitionInput');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                updateCompetitionTitle(input.value);
            }
        });
    }
    
    // Edit competition title button
    const editBtn = document.getElementById('editCompetitionBtn');
    if (editBtn) {
        editBtn.addEventListener('click', openCompetitionModal);
    }
}

// Run when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadCommonHeader();
    setupCompetitionModal();
});
