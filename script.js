// LOADER
const loader = document.getElementById('loader')
const loaderNum = document.getElementById('loader-num')

let count = 0
const counter = setInterval(() => {
  count += 1
  loaderNum.textContent = count
  if (count === 100) {
    clearInterval(counter)
    setTimeout(() => {
      loader.classList.add('hidden')
    }, 400)
  }
}, 16)

// WORK CARDS — cursor follower effect
const cards = document.querySelectorAll('.work-card')
cards.forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 10
    card.querySelector('.work-card-inner').style.transform = `perspective(800px) rotateX(${-y}deg) rotateY(${x}deg) translateY(-6px)`
  })
  card.addEventListener('mouseleave', () => {
    card.querySelector('.work-card-inner').style.transform = ''
  })
})

// SCROLL REVEAL
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1'
      entry.target.style.transform = 'translateY(0)'
    }
  })
}, { threshold: 0.1 })

document.querySelectorAll('.work-card, .about-inner, .contact-inner').forEach(el => {
  el.style.opacity = '0'
  el.style.transform = 'translateY(40px)'
  el.style.transition = 'opacity 0.8s ease, transform 0.8s ease'
  observer.observe(el)
})
