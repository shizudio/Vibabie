console.log("JavaScript is working")

const loader = document.getElementById('loader')
const loaderNum = document.getElementById('loader-num')

let count = 0

const counter = setInterval(() => {
  count += 10
  loaderNum.textContent = count

  if (count === 100) {
    clearInterval(counter)
    setTimeout(() => {
      loader.classList.add('hidden')
    }, 500)
  }
}, 80)

const btn = document.querySelector(".toggle-btn")
const body = document.querySelector("body")

let isDark = true

btn.addEventListener("click", function() {
  if (isDark) {
    body.style.background = "#f5f0e8"
    body.style.color = "#0d0d0d"
    btn.textContent = "Switch Back"
    isDark = false
  } else {
    body.style.background = "linear-gradient(135deg, #170032 0%, #430a0a 50%, #3e163d 100% )"
    body.style.color = "#f0ebe0"
    btn.textContent = "Switch Mode"
    isDark = true
  }
})

const greeting = document.querySelector("h1")
const hour = new Date().getHours()

let timeOfDay = "Good morning"
if (hour >= 12 && hour < 17) timeOfDay = "Good afternoon"
if (hour >= 17) timeOfDay = "Good evening"

greeting.textContent = timeOfDay + ", I'm Shina"
