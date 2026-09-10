import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Heart, Droplets, Moon, ChevronRight, ChevronLeft,
  Activity, RefreshCw, Info, AlertCircle, CheckCircle2,
} from 'lucide-react'
import ToolLayout from '../../components/layout/ToolLayout'
import { cn } from '../../lib/utils'

type SubTab = 'tips' | 'bmi' | 'water' | 'sleep'

const HEALTH_TIPS = [
  { title: 'Stay Hydrated', body: 'Drink at least 8 glasses of water daily. Water regulates body temperature, transports nutrients, and removes waste. Even mild dehydration — as little as 1–2% — can impair concentration, memory, and mood. Keep a water bottle at your desk and sip throughout the day.', emoji: '💧', color: '#BAE6FD' },
  { title: 'Move Every Hour', body: 'Sitting for long periods slows blood flow and tightens muscles. Standing up and stretching for 5 minutes every hour improves circulation, reduces back pain, and re-energizes your brain. Set a quiet reminder on your phone to move regularly during class or study time.', emoji: '🚶', color: '#BBF7D0' },
  { title: 'Get Enough Sleep', body: 'Teenagers need 8–10 hours of sleep per night. During sleep, the brain consolidates memories, repairs cells, and releases growth hormones. Chronic sleep deprivation is linked to lower grades, weakened immunity, and poor emotional regulation. Prioritize a consistent sleep schedule.', emoji: '😴', color: '#E9D5FF' },
  { title: 'Eat a Balanced Meal', body: 'A balanced diet includes carbohydrates (energy), proteins (repair and growth), healthy fats (brain function), vitamins, and minerals. Skipping meals — especially breakfast — reduces concentration and increases fatigue. Aim for colorful plates: the more variety, the more nutrients.', emoji: '🥗', color: '#FEF08A' },
  { title: 'Follow the 20-20-20 Rule', body: 'Extended screen time strains the eyes. Every 20 minutes, look at something 20 feet away for 20 seconds. This relaxes the eye muscles and reduces digital eye strain. Dim screens in the dark, use night mode after sunset, and blink more consciously while using devices.', emoji: '👁️', color: '#FED7AA' },
  { title: 'Practice Deep Breathing', body: 'Slow, deep breathing activates the parasympathetic nervous system — your body\'s "rest and digest" response. Just 5 minutes of diaphragmatic breathing can lower cortisol (the stress hormone), slow heart rate, and bring a sense of calm. Try 4 counts in, hold 4, exhale for 6.', emoji: '🌬️', color: '#FECACA' },
  { title: 'Wash Your Hands Often', body: 'The average person touches their face 20 times per hour, transferring bacteria and viruses from surfaces. Proper handwashing — soap + 20 seconds of scrubbing — removes over 99% of pathogens. Wash before eating, after using the restroom, and after coughing or sneezing.', emoji: '🧼', color: '#BAE6FD' },
  { title: 'Stay Socially Connected', body: 'Human beings are wired for social connection. Positive relationships reduce stress, boost immunity, and increase overall happiness. Loneliness, on the other hand, has health effects comparable to smoking 15 cigarettes a day. Make time to talk, laugh, and share with friends and family every day.', emoji: '🤝', color: '#BBF7D0' },
  { title: 'Limit Sugary Drinks', body: 'Sodas, energy drinks, and flavored juices are high in added sugar, which causes rapid blood sugar spikes followed by crashes — leaving you tired, irritable, and unable to focus. These drinks also contribute to tooth decay and weight gain. Choose water, milk, or unsweetened tea instead.', emoji: '🚫', color: '#FEF08A' },
  { title: 'Spend Time Outdoors', body: 'Natural sunlight triggers the release of serotonin — a mood-stabilizing chemical — and helps your body produce Vitamin D, essential for bone health and immune function. Even 15–30 minutes of outdoor time daily can improve mood, reduce anxiety, and reset your circadian rhythm.', emoji: '☀️', color: '#FED7AA' },
]

// ── HEALTH TIPS CAROUSEL ──────────────────────────────────────────────────────
function HealthTipsCarousel() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  // Auto-slide every 5 seconds
  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setIndex(i => (i + 1) % HEALTH_TIPS.length), 5000)
    return () => clearInterval(t)
  }, [paused])

  const prev = () => { setPaused(true); setIndex(i => (i - 1 + HEALTH_TIPS.length) % HEALTH_TIPS.length) }
  const next = () => { setPaused(true); setIndex(i => (i + 1) % HEALTH_TIPS.length) }
  const goTo = (i: number) => { setPaused(true); setIndex(i) }

  const tip = HEALTH_TIPS[index]

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="font-poppins font-bold text-gray-800 text-xl">Daily Wellness Tips</h2>
        <p className="text-sm text-gray-400 font-inter mt-1">Auto-advances every 5 seconds · {index + 1} of {HEALTH_TIPS.length}</p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-xl rounded-3xl p-8 text-center border border-white/60 shadow-lg transition-all duration-500"
        style={{ backgroundColor: tip.color + '88', minHeight: 260 }}
      >
        <div className="text-6xl mb-5">{tip.emoji}</div>
        <h3 className="font-poppins font-bold text-gray-900 text-2xl mb-4">{tip.title}</h3>
        <p className="font-inter text-gray-700 text-sm sm:text-base leading-relaxed">{tip.body}</p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mt-5">
        <button onClick={prev} className="p-3 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-primary hover:border-primary transition-all touch-manipulation shadow-sm">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-2">
          {HEALTH_TIPS.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} className={cn('h-2 rounded-full transition-all', i === index ? 'bg-primary w-7' : 'bg-gray-300 w-2 hover:bg-gray-400')} />
          ))}
        </div>
        <button onClick={next} className="p-3 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-primary hover:border-primary transition-all touch-manipulation shadow-sm">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Pause indicator */}
      {paused && (
        <button onClick={() => setPaused(false)} className="mt-3 text-xs text-gray-400 font-inter hover:text-primary transition-colors">
          ▶ Resume auto-play
        </button>
      )}
    </div>
  )
}

// ── BMI CALCULATOR ────────────────────────────────────────────────────────────
function BMICalculator() {
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [result, setResult] = useState<{ bmi: number; category: string; color: string; advice: string } | null>(null)

  const calculate = () => {
    const h = parseFloat(height) / 100
    const w = parseFloat(weight)
    if (!h || !w || h <= 0 || w <= 0) return
    const bmi = w / (h * h)
    let category = '', color = '', advice = ''
    if (bmi < 18.5) {
      category = 'Underweight'; color = '#3B82F6'
      advice = 'You may not be getting enough nutrients. Consult a healthcare professional and focus on nutrient-dense foods like nuts, whole grains, dairy, and lean proteins.'
    } else if (bmi < 25) {
      category = 'Normal Weight'; color = '#22C55E'
      advice = 'Great job! You\'re in a healthy weight range. Maintain this with regular physical activity (at least 60 min/day for teens) and a balanced diet.'
    } else if (bmi < 30) {
      category = 'Overweight'; color = '#F59E0B'
      advice = 'Being overweight increases the risk of heart disease and diabetes. Consider reducing sugar and processed foods, and aim for at least 30 minutes of exercise daily.'
    } else {
      category = 'Obese'; color = '#EF4444'
      advice = 'Obesity significantly raises health risks. Please consult a doctor or nutritionist to create a safe, personalized plan for improving your health.'
    }
    setResult({ bmi, category, color, advice })
  }

  const reset = () => { setHeight(''); setWeight(''); setResult(null) }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Educational intro */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-poppins font-bold text-gray-800 text-base">What is BMI?</h3>
        </div>
        <p className="font-inter text-sm text-gray-600 leading-relaxed mb-3">
          <strong>Body Mass Index (BMI)</strong> is a simple screening tool that uses your height and weight to estimate whether you have a healthy body weight. It is calculated by dividing your weight in kilograms by the square of your height in meters (<em>kg/m²</em>).
        </p>
        <p className="font-inter text-sm text-gray-600 leading-relaxed">
          BMI is widely used in schools and clinics because it is quick and non-invasive. However, it does <em>not</em> measure body fat directly — athletes may have a high BMI due to muscle mass. Always combine BMI with other health indicators and consult a professional for a complete picture.
        </p>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-poppins font-semibold">
          <div className="py-2 px-1 bg-blue-50 text-blue-700 rounded-xl">Under 18.5<br /><span className="font-inter font-normal">Underweight</span></div>
          <div className="py-2 px-1 bg-green-50 text-green-700 rounded-xl">18.5–24.9<br /><span className="font-inter font-normal">Normal</span></div>
          <div className="py-2 px-1 bg-yellow-50 text-yellow-700 rounded-xl">25–29.9<br /><span className="font-inter font-normal">Overweight</span></div>
          <div className="py-2 px-1 bg-red-50 text-red-700 rounded-xl">30 and up<br /><span className="font-inter font-normal">Obese</span></div>
        </div>
      </div>

      {/* Calculator */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
        <h3 className="font-poppins font-semibold text-gray-700 text-sm">Calculate Your BMI</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-poppins font-semibold text-gray-500 mb-1.5">Height (cm)</label>
            <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="e.g. 165" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-poppins font-semibold text-gray-500 mb-1.5">Weight (kg)</label>
            <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 60" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={calculate} className="flex-1 py-3 bg-primary text-white font-poppins font-semibold text-sm rounded-xl hover:bg-primary-dark transition-all touch-manipulation">Calculate BMI</button>
          <button onClick={reset} className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all touch-manipulation"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {result && (
        <div className="mt-4 bg-white rounded-2xl p-5 border-2 shadow-sm" style={{ borderColor: result.color + '55' }}>
          <div className="text-center mb-4">
            <p className="text-xs font-poppins font-semibold text-gray-400 uppercase tracking-wider mb-1">Your BMI</p>
            <p className="text-5xl font-poppins font-bold mb-1" style={{ color: result.color }}>{result.bmi.toFixed(1)}</p>
            <span className="inline-block px-4 py-1.5 rounded-full text-sm font-poppins font-semibold text-white" style={{ backgroundColor: result.color }}>{result.category}</span>
          </div>
          {/* Bar */}
          <div className="mb-4 bg-gray-50 rounded-xl p-3">
            <div className="h-3 rounded-full overflow-hidden flex mb-1.5">
              <div className="flex-1 bg-blue-300" />
              <div className="flex-1 bg-green-400" />
              <div className="flex-1 bg-yellow-400" />
              <div className="flex-1 bg-red-400" />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 font-inter">
              <span>Underweight</span><span>Normal</span><span>Overweight</span><span>Obese</span>
            </div>
          </div>
          {/* Advice */}
          <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: result.color + '18' }}>
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: result.color }} />
            <p className="font-inter text-sm text-gray-700 leading-relaxed">{result.advice}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── WATER CALCULATOR ──────────────────────────────────────────────────────────
function WaterCalculator() {
  const [weight, setWeight]     = useState('')
  const [activity, setActivity] = useState('moderate')
  const [result, setResult]     = useState<number | null>(null)

  const ACTIVITY_LEVELS = [
    { id: 'low',      label: 'Low',      desc: 'Mostly sitting',   multiplier: 30, emoji: '🪑' },
    { id: 'moderate', label: 'Moderate', desc: 'Some walking',     multiplier: 35, emoji: '🚶' },
    { id: 'high',     label: 'High',     desc: 'Active / sports',  multiplier: 40, emoji: '🏃' },
  ]

  const calculate = () => {
    const w = parseFloat(weight)
    if (!w || w <= 0) return
    const mult = ACTIVITY_LEVELS.find(a => a.id === activity)?.multiplier ?? 35
    setResult((w * mult) / 1000)
  }

  const reset = () => { setWeight(''); setResult(null) }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Educational intro */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Droplets className="w-5 h-5 text-blue-400" />
          <h3 className="font-poppins font-bold text-gray-800 text-base">Why Hydration Matters</h3>
        </div>
        <p className="font-inter text-sm text-gray-600 leading-relaxed mb-3">
          The human body is about <strong>60% water</strong>. Water is essential for nearly every bodily function — digesting food, transporting oxygen in blood, regulating body temperature, and lubricating joints. Even mild dehydration (losing just 2% of body water) can cause headaches, reduced alertness, and difficulty concentrating.
        </p>
        <p className="font-inter text-sm text-gray-600 leading-relaxed mb-3">
          Your daily water needs depend on your <strong>body weight</strong> and <strong>how active you are</strong>. A common formula is: <em>30–40 mL per kilogram of body weight</em>. Higher activity levels, hot weather, and illness all increase your fluid requirements.
        </p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="py-2.5 px-2 bg-blue-50 rounded-xl">
            <p className="font-poppins font-bold text-blue-700">30 mL/kg</p>
            <p className="text-blue-500 font-inter mt-0.5">Low Activity</p>
          </div>
          <div className="py-2.5 px-2 bg-blue-100 rounded-xl">
            <p className="font-poppins font-bold text-blue-700">35 mL/kg</p>
            <p className="text-blue-500 font-inter mt-0.5">Moderate</p>
          </div>
          <div className="py-2.5 px-2 bg-blue-200 rounded-xl">
            <p className="font-poppins font-bold text-blue-800">40 mL/kg</p>
            <p className="text-blue-600 font-inter mt-0.5">High Activity</p>
          </div>
        </div>
        <p className="font-inter text-xs text-gray-400 mt-3">
          💡 Signs of dehydration: dark yellow urine, dry mouth, fatigue, dizziness, and reduced output. Aim for pale yellow urine throughout the day.
        </p>
      </div>

      {/* Calculator */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
        <h3 className="font-poppins font-semibold text-gray-700 text-sm">Estimate Your Daily Water Intake</h3>
        <div>
          <label className="block text-xs font-poppins font-semibold text-gray-500 mb-1.5">Body Weight (kg)</label>
          <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 55" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-inter text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400" />
        </div>
        <div>
          <label className="block text-xs font-poppins font-semibold text-gray-500 mb-2">Activity Level</label>
          <div className="grid grid-cols-3 gap-2">
            {ACTIVITY_LEVELS.map(a => (
              <button key={a.id} onClick={() => setActivity(a.id)} className={cn('py-3 px-2 rounded-xl text-center transition-all touch-manipulation border-2', activity === a.id ? 'bg-blue-50 border-blue-400' : 'border-gray-200 hover:border-gray-300')}>
                <p className="text-xl mb-0.5">{a.emoji}</p>
                <p className={cn('font-poppins font-semibold text-sm', activity === a.id ? 'text-blue-700' : 'text-gray-700')}>{a.label}</p>
                <p className="text-[10px] text-gray-400 font-inter">{a.desc}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={calculate} className="flex-1 py-3 bg-blue-500 text-white font-poppins font-semibold text-sm rounded-xl hover:bg-blue-600 transition-all touch-manipulation">Calculate</button>
          <button onClick={reset} className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all touch-manipulation"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {result !== null && (
        <div className="mt-4 bg-white rounded-2xl p-5 border-2 border-blue-200 shadow-sm text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Droplets className="w-8 h-8 text-blue-400" />
          </div>
          <p className="text-xs font-poppins font-semibold text-gray-400 uppercase tracking-wider mb-1">Daily Water Intake</p>
          <p className="text-5xl font-poppins font-bold text-blue-500 mb-1">{result.toFixed(1)}<span className="text-xl text-blue-300"> L</span></p>
          <p className="text-sm text-gray-500 font-inter mb-3">≈ {Math.round(result * 4)} glasses of 250 mL each</p>
          {/* Glass icons */}
          <div className="flex gap-1.5 justify-center flex-wrap mb-4">
            {Array.from({ length: Math.min(Math.round(result * 4), 16) }).map((_, i) => (
              <div key={i} className="w-5 h-7 bg-blue-100 rounded-b-lg rounded-t-sm border border-blue-200 flex flex-col-reverse overflow-hidden">
                <div className="bg-blue-400 w-full" style={{ height: '70%' }} />
              </div>
            ))}
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-left">
            <p className="text-xs font-poppins font-semibold text-blue-700 mb-1">Tips to reach your goal:</p>
            <ul className="text-xs text-blue-600 font-inter space-y-0.5 list-disc list-inside">
              <li>Drink a glass of water when you wake up</li>
              <li>Carry a reusable water bottle to school</li>
              <li>Drink a glass before each meal</li>
              <li>Replace sodas with water or unsweetened drinks</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SLEEP CALCULATOR ──────────────────────────────────────────────────────────
function SleepCalculator() {
  const [age, setAge]           = useState('')
  const [wakeTime, setWakeTime] = useState('06:00')
  const [result, setResult]     = useState<{ hours: string; bedtimes: string[]; label: string } | null>(null)

  const AGE_GROUPS = [
    { range: '6–12 years',  min: 6, max: 12, sleep: '9–12 hours', note: 'School-age children' },
    { range: '13–18 years', min: 13, max: 18, sleep: '8–10 hours', note: 'Teenagers' },
    { range: '18–25 years', min: 18, max: 25, sleep: '7–9 hours',  note: 'Young adults' },
    { range: '26+ years',   min: 26, max: 99, sleep: '7–8 hours',  note: 'Adults' },
  ]

  const calculate = () => {
    const a = parseInt(age)
    if (!a || a < 5) return
    const group = AGE_GROUPS.find(g => a >= g.min && a <= g.max) ?? AGE_GROUPS[3]
    const hours = group.sleep
    const [wakeH, wakeM] = wakeTime.split(':').map(Number)
    const wakeTotal = wakeH * 60 + wakeM
    const minH = parseInt(hours.split('–')[0])
    const maxH = parseInt(hours.split('–')[1])
    const midH = Math.round((minH + maxH) / 2)
    const bedtimes = [maxH, midH, minH].map(h => {
      let bed = wakeTotal - h * 60
      if (bed < 0) bed += 24 * 60
      const bh = Math.floor(bed / 60), bm = bed % 60
      const period = bh >= 12 ? 'PM' : 'AM'
      const displayH = bh > 12 ? bh - 12 : bh === 0 ? 12 : bh
      return `${displayH}:${bm.toString().padStart(2, '0')} ${period}`
    })
    setResult({ hours, bedtimes, label: group.range })
  }

  const reset = () => { setAge(''); setResult(null) }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Educational intro */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Moon className="w-5 h-5 text-purple-400" />
          <h3 className="font-poppins font-bold text-gray-800 text-base">Why Sleep is Essential</h3>
        </div>
        <p className="font-inter text-sm text-gray-600 leading-relaxed mb-3">
          Sleep is not just rest — it is an <strong>active biological process</strong>. During sleep, your brain consolidates memories (moving information from short-term to long-term storage), your body produces growth hormones, your immune system strengthens, and damaged cells are repaired.
        </p>
        <p className="font-inter text-sm text-gray-600 leading-relaxed mb-3">
          Teenagers are in a unique biological phase where the brain's sleep-wake clock naturally shifts later — making it harder to fall asleep early. Despite this, many teens get only 6–7 hours, leading to <em>chronic sleep debt</em> that affects academic performance, emotional control, and physical health.
        </p>
        <div className="bg-purple-50 rounded-xl p-3 mb-3">
          <p className="text-xs font-poppins font-semibold text-purple-700 mb-2">Sleep Recommendations by Age (WHO / CDC)</p>
          <div className="space-y-1">
            {[
              { group: 'School-age (6–12)', hours: '9–12 hours' },
              { group: 'Teenagers (13–18)', hours: '8–10 hours' },
              { group: 'Young Adults (18–25)', hours: '7–9 hours' },
              { group: 'Adults (26+)', hours: '7–8 hours' },
            ].map(r => (
              <div key={r.group} className="flex justify-between text-xs font-inter">
                <span className="text-gray-600">{r.group}</span>
                <span className="font-poppins font-semibold text-purple-600">{r.hours}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="font-inter text-xs text-gray-400">
          💡 Signs of sleep deprivation: difficulty waking up, poor focus, irritability, frequent yawning, and relying on caffeine to stay alert.
        </p>
      </div>

      {/* Calculator */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
        <h3 className="font-poppins font-semibold text-gray-700 text-sm">Find Your Ideal Bedtime</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-poppins font-semibold text-gray-500 mb-1.5">Age (years)</label>
            <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 16" min="5" max="60" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-inter text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400" />
          </div>
          <div>
            <label className="block text-xs font-poppins font-semibold text-gray-500 mb-1.5">Wake-up Time</label>
            <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-inter text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={calculate} className="flex-1 py-3 bg-purple-500 text-white font-poppins font-semibold text-sm rounded-xl hover:bg-purple-600 transition-all touch-manipulation">Calculate Bedtime</button>
          <button onClick={reset} className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all touch-manipulation"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {result && (
        <div className="mt-4 bg-white rounded-2xl p-5 border-2 border-purple-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-purple-100">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
              <Moon className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-inter">{result.label} · Wake up at {wakeTime}</p>
              <p className="font-poppins font-bold text-purple-600 text-lg">Needs {result.hours} of sleep</p>
            </div>
          </div>
          <p className="text-xs font-poppins font-semibold text-gray-500 uppercase tracking-wider mb-3">Suggested Bedtimes (earliest → latest)</p>
          <div className="flex gap-2 mb-4">
            {result.bedtimes.map((t, i) => (
              <div key={i} className={cn('flex-1 py-3 rounded-xl text-center border-2 transition-all', i === 1 ? 'bg-purple-500 border-purple-500' : 'bg-purple-50 border-purple-200')}>
                <p className={cn('font-poppins font-bold text-base', i === 1 ? 'text-white' : 'text-purple-700')}>{t}</p>
                {i === 0 && <p className="text-[10px] text-purple-400 font-inter">Min sleep</p>}
                {i === 1 && <p className="text-[10px] text-white/70 font-inter">Ideal</p>}
                {i === 2 && <p className="text-[10px] text-purple-400 font-inter">Max sleep</p>}
              </div>
            ))}
          </div>
          <div className="bg-purple-50 rounded-xl p-3">
            <p className="text-xs font-poppins font-semibold text-purple-700 mb-1">Tips for better sleep:</p>
            <ul className="text-xs text-purple-600 font-inter space-y-0.5 list-disc list-inside">
              <li>Keep a consistent sleep and wake schedule — even on weekends</li>
              <li>Avoid screens (phones, tablets) at least 30 minutes before bed</li>
              <li>Keep your room cool, dark, and quiet</li>
              <li>Avoid caffeine after 2 PM</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
const SUB_TABS = [
  { id: 'tips'  as SubTab, label: 'Health Tips', icon: <Heart className="w-4 h-4" /> },
  { id: 'bmi'   as SubTab, label: 'BMI',         icon: <Activity className="w-4 h-4" /> },
  { id: 'water' as SubTab, label: 'Water Intake', icon: <Droplets className="w-4 h-4" /> },
  { id: 'sleep' as SubTab, label: 'Sleep',        icon: <Moon className="w-4 h-4" /> },
]

export default function HealthPage() {
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as SubTab | null)
  const [tab, setTab] = useState<SubTab>(
    initialTab && ['tips','bmi','water','sleep'].includes(initialTab) ? initialTab : 'tips'
  )

  return (
    <ToolLayout
      title="Student Wellness Tools"
      subtitle="Health Tips · BMI · Water · Sleep"
      icon={<Heart className="w-4 h-4" />}
      fullHeight={tab === 'tips'}
    >
      {/* Sub-tab bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none flex-shrink-0">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-poppins font-semibold whitespace-nowrap transition-all touch-manipulation min-h-[44px]',
              tab === t.id ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* No-login notice */}
      <div className="flex items-center gap-2 mx-4 mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-xl flex-shrink-0">
        <Info className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        <p className="text-xs text-green-700 font-inter">No login required · Inputs are cleared when you leave · Nothing is stored</p>
      </div>

      {/* Tab content */}
      {tab === 'tips' ? (
        <HealthTipsCarousel />
      ) : (
        <div className="p-4 sm:p-6 overflow-y-auto">
          {tab === 'bmi'   && <BMICalculator />}
          {tab === 'water' && <WaterCalculator />}
          {tab === 'sleep' && <SleepCalculator />}
        </div>
      )}
    </ToolLayout>
  )
}
