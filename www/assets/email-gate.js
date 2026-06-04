function handleSubmit() {
      const input = document.getElementById('email-input');
      const email = input.value.trim();

      if (!email || !email.includes('@')) {
        input.style.borderColor = '#ef4444';
        input.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
        input.focus();
        setTimeout(() => {
          input.style.borderColor = '';
          input.style.boxShadow = '';
        }, 1800);
        return;
      }

      // Send email to Google Sheets
      fetch('https://script.google.com/macros/s/AKfycbwMklyPs3fB9eZStdqPwfolgAzUYO9LHbAxtjX2s53sXC_6ykvgxHZD9TTMaVX5hbYc/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'email=' + encodeURIComponent(email)
      }).catch(() => {});

      // Detect iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

      if (isIOS) {
        // iOS fallback: show image in overlay with instructions
        document.getElementById('main-content').style.display = 'none';
        const iosOverlay = document.getElementById('ios-download');
        iosOverlay.style.display = 'flex';
        window.open('/assets/recipe-bruschetta.pdf', '_blank');
        localStorage.setItem('story1_completed', '1');
      } else {
        // Standard download
        const link = document.createElement('a');
        link.href = '/assets/recipe-bruschetta.pdf';
        link.download = 'ברוסקטות_חיפושיות.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Show success
        document.getElementById('main-content').style.display = 'none';
        const success = document.getElementById('success-state');
        success.style.display = 'flex';
        localStorage.setItem('story1_completed', '1');
      }
    }

    document.getElementById('email-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSubmit();
    });