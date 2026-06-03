// Initialize Lucide icons
    lucide.createIcons();

function selectRole(card) {
    // Remove selected class from all cards
    document.querySelectorAll('.role-card').forEach(c => {
        c.classList.remove('selected');
    });       
    // adds the selected class to clicked card
    card.classList.add('selected');         
    // updates the colours of the icons when selected
    lucide.createIcons();
}
function selectRole(element){
    const cards=document.querySelectorAll('.role-card');
    cards.forEach(card=>card.classList.remove('selected'));
    element.classList.add('selected');

    const targetURL=element.getAttribute('data-url');
    if(targetURL) {
        window.location.href=targetURL;
    }
}
