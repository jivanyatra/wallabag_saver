// dark mode logic
const darkModeKey = 'wallabag_dark_mode';
chrome.storage && chrome.storage.local.get([darkModeKey], (result) => {
  if (result && result[darkModeKey]) document.body.classList.add('dark-mode');
});
