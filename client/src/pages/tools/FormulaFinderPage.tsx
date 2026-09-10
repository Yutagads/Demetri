import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  Search, Calculator, ChevronRight, TrendingUp, X,
  Pencil, Minus, Trash2, Download, BarChart2,
  ZoomIn, ZoomOut, RotateCcw, Move, Undo2,
} from 'lucide-react'
import ToolLayout from '../../components/layout/ToolLayout'
import { cn } from '../../lib/utils'

// ── FORMULA DATA ─────────────────────────────────────────────────────────────

interface Formula {
  id: string
  topic: string
  name: string
  formula: string
  variables: { symbol: string; meaning: string }[]
  example: string
  fn?: string
}

const FORMULAS: Formula[] = [
  // ── Algebra ──────────────────────────────────────────────────────────────────
  { id:'quad',          topic:'Algebra',      name:'Quadratic Formula',           formula:'x = (−b ± √(b²−4ac)) / 2a',         variables:[{symbol:'a,b,c',meaning:'coefficients of ax²+bx+c=0'},{symbol:'x',meaning:'roots'}],                                             example:'x²−5x+6=0 → x=3 or 2',                fn:'(x) => x*x - 3*x + 2' },
  { id:'slope',         topic:'Algebra',      name:'Slope Formula',               formula:'m = (y₂−y₁) / (x₂−x₁)',             variables:[{symbol:'m',meaning:'slope'},{symbol:'(x₁,y₁),(x₂,y₂)',meaning:'two points'}],                                                    example:'(1,2)→(3,8): m=3',                     fn:'(x) => 3*x - 1' },
  { id:'linear',        topic:'Algebra',      name:'Slope-Intercept Form',        formula:'y = mx + b',                          variables:[{symbol:'m',meaning:'slope'},{symbol:'b',meaning:'y-intercept'}],                                                               example:'y=2x+3',                               fn:'(x) => 2*x + 3' },
  { id:'pt-slope',      topic:'Algebra',      name:'Point-Slope Form',            formula:'y − y₁ = m(x − x₁)',                 variables:[{symbol:'m',meaning:'slope'},{symbol:'(x₁,y₁)',meaning:'known point on line'}],                                                  example:'m=2,point(1,3) → y−3=2(x−1)',          fn:'(x) => 2*(x-1)+3' },
  { id:'exponent',      topic:'Algebra',      name:'Laws of Exponents',           formula:'aⁿ × aᵐ = aⁿ⁺ᵐ',                    variables:[{symbol:'a',meaning:'base'},{symbol:'n,m',meaning:'exponents'}],                                                                  example:'2³×2²=2⁵=32',                         fn:'(x) => Math.pow(2,x)' },
  { id:'neg-exp',       topic:'Algebra',      name:'Negative Exponent',           formula:'a⁻ⁿ = 1 / aⁿ',                       variables:[{symbol:'a',meaning:'base (a≠0)'},{symbol:'n',meaning:'positive exponent'}],                                                     example:'2⁻³=1/8=0.125',                        fn:'(x) => Math.pow(2,-x)' },
  { id:'dist',          topic:'Algebra',      name:'Distance Formula',            formula:'d = √((x₂−x₁)² + (y₂−y₁)²)',         variables:[{symbol:'d',meaning:'distance'},{symbol:'(x₁,y₁),(x₂,y₂)',meaning:'endpoints'}],                                               example:'(0,0)→(3,4): d=5' },
  { id:'midpoint',      topic:'Algebra',      name:'Midpoint Formula',            formula:'M = ((x₁+x₂)/2, (y₁+y₂)/2)',         variables:[{symbol:'M',meaning:'midpoint'},{symbol:'(x₁,y₁),(x₂,y₂)',meaning:'endpoints'}],                                               example:'(2,4)&(6,8) → M=(4,6)' },
  { id:'abs',           topic:'Algebra',      name:'Absolute Value',              formula:'|x| = x if x≥0 ; −x if x<0',         variables:[{symbol:'x',meaning:'real number'}],                                                                                             example:'|−7|=7',                               fn:'(x) => Math.abs(x)' },
  { id:'arith',         topic:'Algebra',      name:'Arithmetic Sequence',         formula:'aₙ = a₁ + (n−1)d',                    variables:[{symbol:'aₙ',meaning:'nth term'},{symbol:'a₁',meaning:'first term'},{symbol:'d',meaning:'common difference'}],                 example:'a₁=2, d=3: a₅=14',                    fn:'(x) => 2 + (x-1)*3' },
  { id:'arith-sum',     topic:'Algebra',      name:'Arithmetic Series Sum',       formula:'Sₙ = n/2 × (a₁ + aₙ)',               variables:[{symbol:'Sₙ',meaning:'sum of n terms'},{symbol:'a₁',meaning:'first term'},{symbol:'aₙ',meaning:'nth term'}],                   example:'1+2+…+10 = 10/2×(1+10)=55' },
  { id:'geo',           topic:'Algebra',      name:'Geometric Sequence',          formula:'aₙ = a₁ × rⁿ⁻¹',                     variables:[{symbol:'r',meaning:'common ratio'},{symbol:'a₁',meaning:'first term'}],                                                        example:'a₁=1, r=2: a₅=16',                   fn:'(x) => Math.pow(2,x-1)' },
  { id:'geo-sum',       topic:'Algebra',      name:'Geometric Series Sum',        formula:'Sₙ = a₁(1−rⁿ) / (1−r)',             variables:[{symbol:'a₁',meaning:'first term'},{symbol:'r',meaning:'ratio (r≠1)'},{symbol:'n',meaning:'number of terms'}],                   example:'1+2+4+8 = 1(1−2⁴)/(1−2)=15' },
  { id:'log',           topic:'Algebra',      name:'Logarithm',                   formula:'logₐ(b)=c ↔ aᶜ=b',                  variables:[{symbol:'a',meaning:'base (a>0,a≠1)'},{symbol:'b',meaning:'argument'},{symbol:'c',meaning:'exponent'}],                          example:'log₂(8)=3',                           fn:'(x) => Math.log(x)' },
  { id:'log-change',    topic:'Algebra',      name:'Change of Base',              formula:'logₐ(b) = log(b) / log(a)',           variables:[{symbol:'a',meaning:'original base'},{symbol:'b',meaning:'argument'}],                                                           example:'log₃(9)=log9/log3=2' },
  { id:'sqrt',          topic:'Algebra',      name:'Square Root',                 formula:'√x = x^(1/2)',                        variables:[{symbol:'x',meaning:'radicand (x≥0)'}],                                                                                          example:'√144=12',                             fn:'(x) => Math.sqrt(x)' },
  { id:'poly3',         topic:'Algebra',      name:'Cubic Polynomial',            formula:'y = x³',                              variables:[{symbol:'x',meaning:'variable'},{symbol:'y',meaning:'output'}],                                                                 example:'x=2 → y=8',                           fn:'(x) => x*x*x' },
  { id:'parabola',      topic:'Algebra',      name:'Parabola (vertex form)',       formula:'y = a(x−h)² + k',                    variables:[{symbol:'a',meaning:'stretch factor'},{symbol:'(h,k)',meaning:'vertex'}],                                                        example:'y=(x−2)²+1',                          fn:'(x) => (x-2)*(x-2)+1' },
  { id:'complete-sq',   topic:'Algebra',      name:'Completing the Square',       formula:'x² + bx = (x + b/2)² − (b/2)²',     variables:[{symbol:'b',meaning:'coefficient of x'},{symbol:'(b/2)²',meaning:'constant added to both sides'}],                               example:'x²+6x=(x+3)²−9' },
  { id:'discriminant',  topic:'Algebra',      name:'Discriminant',                formula:'Δ = b² − 4ac',                        variables:[{symbol:'Δ',meaning:'discriminant'},{symbol:'a,b,c',meaning:'quadratic coefficients'}],                                          example:'Δ>0 two roots, Δ=0 one root, Δ<0 none' },
  { id:'rational',      topic:'Algebra',      name:'Rational Function',           formula:'f(x) = 1/x',                          variables:[{symbol:'x',meaning:'input (x≠0)'}],                                                                                             example:'f(2)=0.5',                            fn:'(x) => 1/x' },
  { id:'exp-growth',    topic:'Algebra',      name:'Exponential Growth',          formula:'y = aᵉˣ',                             variables:[{symbol:'a',meaning:'initial value'},{symbol:'e',meaning:'base (≈2.718)'}],                                                      example:'y=e²≈7.39 at x=2',                   fn:'(x) => Math.exp(x)' },
  { id:'exp-decay',     topic:'Algebra',      name:'Exponential Decay',           formula:'y = e⁻ˣ',                             variables:[{symbol:'x',meaning:'time'},{symbol:'e',meaning:'Euler\'s number'}],                                                             example:'y=e⁻¹≈0.37 at x=1',                  fn:'(x) => Math.exp(-x)' },
  { id:'nat-log',       topic:'Algebra',      name:'Natural Logarithm',           formula:'ln(x) = log_e(x)',                    variables:[{symbol:'x',meaning:'positive real number'},{symbol:'e',meaning:'≈2.718'}],                                                      example:'ln(e²)=2',                            fn:'(x) => Math.log(x)' },

  // ── Geometry ─────────────────────────────────────────────────────────────────
  { id:'area-circle',   topic:'Geometry',     name:'Area of Circle',              formula:'A = πr²',                             variables:[{symbol:'r',meaning:'radius'},{symbol:'π',meaning:'≈3.14159'}],                                                               example:'r=5 → A≈78.54',                       fn:'(x) => Math.PI*x*x' },
  { id:'circ',          topic:'Geometry',     name:'Circumference',               formula:'C = 2πr',                             variables:[{symbol:'C',meaning:'perimeter of circle'},{symbol:'r',meaning:'radius'}],                                                     example:'r=7 → C≈43.98',                      fn:'(x) => 2*Math.PI*x' },
  { id:'pyth',          topic:'Geometry',     name:'Pythagorean Theorem',         formula:'c² = a² + b²',                        variables:[{symbol:'a,b',meaning:'legs'},{symbol:'c',meaning:'hypotenuse'}],                                                              example:'a=3,b=4 → c=5',                       fn:'(x) => Math.sqrt(x*x+16)' },
  { id:'area-tri',      topic:'Geometry',     name:'Area of Triangle',            formula:'A = ½ × b × h',                       variables:[{symbol:'b',meaning:'base'},{symbol:'h',meaning:'perpendicular height'}],                                                      example:'b=6, h=4 → A=12' },
  { id:'heron',         topic:'Geometry',     name:"Heron's Formula",             formula:'A = √(s(s−a)(s−b)(s−c))',            variables:[{symbol:'a,b,c',meaning:'side lengths'},{symbol:'s',meaning:'semi-perimeter = (a+b+c)/2'}],                                    example:'3,4,5: s=6, A=√(6×3×2×1)=6' },
  { id:'area-rect',     topic:'Geometry',     name:'Area of Rectangle',           formula:'A = l × w',                           variables:[{symbol:'l',meaning:'length'},{symbol:'w',meaning:'width'}],                                                                   example:'l=8, w=5 → A=40' },
  { id:'area-trap',     topic:'Geometry',     name:'Area of Trapezoid',           formula:'A = ½(b₁+b₂) × h',                   variables:[{symbol:'b₁,b₂',meaning:'parallel bases'},{symbol:'h',meaning:'height'}],                                                    example:'b₁=4,b₂=6,h=3 → A=15' },
  { id:'area-para',     topic:'Geometry',     name:'Area of Parallelogram',       formula:'A = base × height',                   variables:[{symbol:'base',meaning:'length of base'},{symbol:'height',meaning:'perpendicular height'}],                                    example:'b=7,h=4 → A=28' },
  { id:'area-rhombus',  topic:'Geometry',     name:'Area of Rhombus',             formula:'A = (d₁ × d₂) / 2',                  variables:[{symbol:'d₁,d₂',meaning:'diagonals'}],                                                                                          example:'d₁=6,d₂=8 → A=24' },
  { id:'arc-len',       topic:'Geometry',     name:'Arc Length',                  formula:'L = r × θ',                           variables:[{symbol:'L',meaning:'arc length'},{symbol:'r',meaning:'radius'},{symbol:'θ',meaning:'central angle in radians'}],               example:'r=5,θ=1.2rad → L=6' },
  { id:'sector',        topic:'Geometry',     name:'Area of Sector',              formula:'A = ½r²θ',                            variables:[{symbol:'r',meaning:'radius'},{symbol:'θ',meaning:'angle in radians'}],                                                         example:'r=4,θ=π/2 → A≈12.57' },
  { id:'vol-sphere',    topic:'Geometry',     name:'Volume of Sphere',            formula:'V = (4/3)πr³',                        variables:[{symbol:'r',meaning:'radius'}],                                                                                                example:'r=3 → V≈113.1',                      fn:'(x) => (4/3)*Math.PI*x*x*x' },
  { id:'vol-cyl',       topic:'Geometry',     name:'Volume of Cylinder',          formula:'V = πr²h',                            variables:[{symbol:'r',meaning:'radius'},{symbol:'h',meaning:'height'}],                                                                  example:'r=2,h=5 → V≈62.8' },
  { id:'vol-cone',      topic:'Geometry',     name:'Volume of Cone',              formula:'V = (1/3)πr²h',                       variables:[{symbol:'r',meaning:'base radius'},{symbol:'h',meaning:'height'}],                                                             example:'r=3,h=4 → V≈37.7' },
  { id:'vol-pyramid',   topic:'Geometry',     name:'Volume of Pyramid',           formula:'V = (1/3) × base area × h',          variables:[{symbol:'base area',meaning:'area of base'},{symbol:'h',meaning:'perpendicular height'}],                                       example:'base=9,h=4 → V=12' },
  { id:'sa-sphere',     topic:'Geometry',     name:'Surface Area of Sphere',      formula:'SA = 4πr²',                           variables:[{symbol:'r',meaning:'radius'}],                                                                                                example:'r=3 → SA≈113.1',                     fn:'(x) => 4*Math.PI*x*x' },
  { id:'sa-rect',       topic:'Geometry',     name:'Surface Area of Cuboid',      formula:'SA = 2(lw + lh + wh)',                variables:[{symbol:'l',meaning:'length'},{symbol:'w',meaning:'width'},{symbol:'h',meaning:'height'}],                                    example:'l=2,w=3,h=4 → SA=52' },
  { id:'diag-rect',     topic:'Geometry',     name:'Diagonal of Rectangle',       formula:'d = √(l² + w²)',                      variables:[{symbol:'d',meaning:'diagonal'},{symbol:'l',meaning:'length'},{symbol:'w',meaning:'width'}],                                   example:'l=3,w=4 → d=5' },
  { id:'perimeter',     topic:'Geometry',     name:'Perimeter of Rectangle',      formula:'P = 2(l + w)',                        variables:[{symbol:'l',meaning:'length'},{symbol:'w',meaning:'width'}],                                                                   example:'l=5,w=3 → P=16' },

  // ── Trigonometry ─────────────────────────────────────────────────────────────
  { id:'sin',           topic:'Trigonometry', name:'Sine',                        formula:'sin θ = opposite / hypotenuse',       variables:[{symbol:'θ',meaning:'angle in right triangle'}],                                                                               example:'θ=30° → sin30°=0.5',                  fn:'(x) => Math.sin(x)' },
  { id:'cos',           topic:'Trigonometry', name:'Cosine',                      formula:'cos θ = adjacent / hypotenuse',       variables:[{symbol:'θ',meaning:'angle in right triangle'}],                                                                               example:'θ=60° → cos60°=0.5',                  fn:'(x) => Math.cos(x)' },
  { id:'tan',           topic:'Trigonometry', name:'Tangent',                     formula:'tan θ = sin θ / cos θ',               variables:[{symbol:'θ',meaning:'angle'}],                                                                                                 example:'θ=45° → tan45°=1',                    fn:'(x) => Math.tan(x)' },
  { id:'csc',           topic:'Trigonometry', name:'Cosecant',                    formula:'csc θ = 1 / sin θ',                   variables:[{symbol:'θ',meaning:'angle (θ≠0°,180°)'}],                                                                                    example:'θ=30° → csc30°=2',                    fn:'(x) => 1/Math.sin(x)' },
  { id:'sec',           topic:'Trigonometry', name:'Secant',                      formula:'sec θ = 1 / cos θ',                   variables:[{symbol:'θ',meaning:'angle (θ≠90°,270°)'}],                                                                                   example:'θ=60° → sec60°=2',                    fn:'(x) => 1/Math.cos(x)' },
  { id:'cot',           topic:'Trigonometry', name:'Cotangent',                   formula:'cot θ = cos θ / sin θ',               variables:[{symbol:'θ',meaning:'angle (θ≠0°,180°)'}],                                                                                    example:'θ=45° → cot45°=1',                    fn:'(x) => Math.cos(x)/Math.sin(x)' },
  { id:'pythtrig',      topic:'Trigonometry', name:'Pythagorean Identity',        formula:'sin²θ + cos²θ = 1',                   variables:[{symbol:'θ',meaning:'any angle'}],                                                                                             example:'sin²30°+cos²30°=1' },
  { id:'law-sines',     topic:'Trigonometry', name:'Law of Sines',                formula:'a/sin A = b/sin B = c/sin C',         variables:[{symbol:'a,b,c',meaning:'sides'},{symbol:'A,B,C',meaning:'opposite angles'}],                                                 example:'a=5,A=30°,B=60° → b≈8.66' },
  { id:'law-cos',       topic:'Trigonometry', name:'Law of Cosines',              formula:'c² = a²+b²−2ab·cos C',               variables:[{symbol:'c',meaning:'unknown side'},{symbol:'C',meaning:'included angle'}],                                                    example:'a=5,b=7,C=60° → c≈6.24' },
  { id:'dbl-sin',       topic:'Trigonometry', name:'Double Angle (sin)',          formula:'sin 2θ = 2 sin θ cos θ',             variables:[{symbol:'θ',meaning:'angle'}],                                                                                                 example:'sin60°=2sin30°cos30°',                fn:'(x) => Math.sin(2*x)' },
  { id:'dbl-cos',       topic:'Trigonometry', name:'Double Angle (cos)',          formula:'cos 2θ = cos²θ−sin²θ',              variables:[{symbol:'θ',meaning:'angle'}],                                                                                                 example:'cos60°=cos²30°−sin²30°',              fn:'(x) => Math.cos(2*x)' },
  { id:'sum-sin',       topic:'Trigonometry', name:'Sum Formula (sin)',           formula:'sin(A±B)=sinA cosB ± cosA sinB',     variables:[{symbol:'A,B',meaning:'any angles'}],                                                                                           example:'sin75°=sin(45°+30°)≈0.966' },
  { id:'sum-cos',       topic:'Trigonometry', name:'Sum Formula (cos)',           formula:'cos(A±B)=cosA cosB ∓ sinA sinB',    variables:[{symbol:'A,B',meaning:'any angles'}],                                                                                           example:'cos75°=cos45°cos30°−sin45°sin30°' },
  { id:'half-sin',      topic:'Trigonometry', name:'Half-Angle (sin)',            formula:'sin(θ/2) = ±√((1−cosθ)/2)',         variables:[{symbol:'θ',meaning:'angle'}],                                                                                                 example:'sin15°=sin(30°/2)=√((1−cos30°)/2)' },
  { id:'deg-rad',       topic:'Trigonometry', name:'Degrees ↔ Radians',          formula:'rad = deg × π/180',                   variables:[{symbol:'rad',meaning:'angle in radians'},{symbol:'deg',meaning:'angle in degrees'}],                                          example:'180°=π rad, 90°=π/2 rad',             fn:'(x) => x * Math.PI / 180' },

  // ── Physics ───────────────────────────────────────────────────────────────────
  { id:'newton2',       topic:'Physics',      name:"Newton's 2nd Law",            formula:'F = ma',                              variables:[{symbol:'F',meaning:'force (N)'},{symbol:'m',meaning:'mass (kg)'},{symbol:'a',meaning:'acceleration (m/s²)'}],                example:'m=10kg,a=5m/s² → F=50N',              fn:'(x) => 10*x' },
  { id:'kinetic',       topic:'Physics',      name:'Kinetic Energy',              formula:'KE = ½mv²',                           variables:[{symbol:'KE',meaning:'kinetic energy (J)'},{symbol:'m',meaning:'mass'},{symbol:'v',meaning:'velocity'}],                      example:'m=2kg,v=3m/s → KE=9J',               fn:'(x) => 0.5*2*x*x' },
  { id:'potential',     topic:'Physics',      name:'Gravitational PE',            formula:'PE = mgh',                            variables:[{symbol:'m',meaning:'mass (kg)'},{symbol:'g',meaning:'9.8 m/s²'},{symbol:'h',meaning:'height (m)'}],                         example:'m=5,h=10 → PE=490J' },
  { id:'velocity',      topic:'Physics',      name:'Velocity',                    formula:'v = d / t',                           variables:[{symbol:'v',meaning:'m/s'},{symbol:'d',meaning:'distance'},{symbol:'t',meaning:'time'}],                                       example:'d=100m,t=10s → v=10m/s',             fn:'(x) => 100/x' },
  { id:'gravity',       topic:'Physics',      name:'Free Fall',                   formula:'d = ½gt²',                            variables:[{symbol:'g',meaning:'9.8 m/s²'},{symbol:'t',meaning:'time (s)'}],                                                             example:'t=3s → d=44.1m',                     fn:'(x) => 0.5*9.8*x*x' },
  { id:'ohm',           topic:'Physics',      name:"Ohm's Law",                   formula:'V = IR',                              variables:[{symbol:'V',meaning:'voltage (V)'},{symbol:'I',meaning:'current (A)'},{symbol:'R',meaning:'resistance (Ω)'}],                 example:'I=2A,R=5Ω → V=10V',                  fn:'(x) => 5*x' },
  { id:'power-e',       topic:'Physics',      name:'Electric Power',              formula:'P = IV = I²R',                        variables:[{symbol:'P',meaning:'power (W)'},{symbol:'I',meaning:'current'},{symbol:'V',meaning:'voltage'}],                              example:'I=3A,V=12V → P=36W',                 fn:'(x) => x*x*2' },
  { id:'momentum',      topic:'Physics',      name:'Momentum',                    formula:'p = mv',                              variables:[{symbol:'p',meaning:'kg·m/s'},{symbol:'m',meaning:'mass'},{symbol:'v',meaning:'velocity'}],                                    example:'m=5kg,v=4m/s → p=20',               fn:'(x) => 5*x' },
  { id:'pressure',      topic:'Physics',      name:'Pressure',                    formula:'P = F / A',                           variables:[{symbol:'P',meaning:'pressure (Pa)'},{symbol:'F',meaning:'force'},{symbol:'A',meaning:'area'}],                               example:'F=100N,A=2m² → P=50Pa',              fn:'(x) => 100/x' },
  { id:'wave',          topic:'Physics',      name:'Wave Speed',                  formula:'v = fλ',                              variables:[{symbol:'v',meaning:'speed (m/s)'},{symbol:'f',meaning:'frequency'},{symbol:'λ',meaning:'wavelength'}],                       example:'f=440Hz,λ=0.77m → v≈338m/s',        fn:'(x) => 340/x' },
  { id:'grav-f',        topic:'Physics',      name:'Gravitational Force',         formula:'F = mg',                              variables:[{symbol:'F',meaning:'weight (N)'},{symbol:'m',meaning:'mass'},{symbol:'g',meaning:'9.8 m/s²'}],                              example:'m=60kg → F=588N',                    fn:'(x) => 9.8*x' },
  { id:'univ-grav',     topic:'Physics',      name:'Universal Gravitation',       formula:'F = G m₁m₂ / r²',                    variables:[{symbol:'G',meaning:'6.674×10⁻¹¹ N·m²/kg²'},{symbol:'m₁,m₂',meaning:'masses'},{symbol:'r',meaning:'distance between'}],   example:'Earth+apple: F=mg=9.8m' },
  { id:'work',          topic:'Physics',      name:'Work',                        formula:'W = F × d × cos θ',                   variables:[{symbol:'W',meaning:'work (J)'},{symbol:'F',meaning:'force'},{symbol:'d',meaning:'displacement'},{symbol:'θ',meaning:'angle'}], example:'F=10N,d=5m,θ=0° → W=50J' },
  { id:'heat',          topic:'Physics',      name:'Specific Heat',               formula:'Q = mcΔT',                            variables:[{symbol:'Q',meaning:'heat (J)'},{symbol:'m',meaning:'mass'},{symbol:'c',meaning:'specific heat'},{symbol:'ΔT',meaning:'temp change'}], example:'m=1kg,c=4186,ΔT=1K → Q=4186J' },
  { id:'hooke',         topic:'Physics',      name:"Hooke's Law",                 formula:'F = −kx',                             variables:[{symbol:'k',meaning:'spring constant (N/m)'},{symbol:'x',meaning:'displacement (m)'}],                                        example:'k=200,x=0.1m → F=20N',               fn:'(x) => -2*x' },
  { id:'centripetal',   topic:'Physics',      name:'Centripetal Force',           formula:'F = mv² / r',                         variables:[{symbol:'m',meaning:'mass'},{symbol:'v',meaning:'speed'},{symbol:'r',meaning:'radius of circle'}],                             example:'m=2,v=3,r=1 → F=18N' },
  { id:'torque',        topic:'Physics',      name:'Torque',                      formula:'τ = r × F × sin θ',                  variables:[{symbol:'τ',meaning:'torque (N·m)'},{symbol:'r',meaning:'lever arm'},{symbol:'F',meaning:'force'},{symbol:'θ',meaning:'angle'}], example:'r=0.5m,F=10N,θ=90° → τ=5N·m' },
  { id:'doppler',       topic:'Physics',      name:'Doppler Effect',              formula:'f′ = f × (v ± v_o) / (v ∓ v_s)',    variables:[{symbol:'f',meaning:'source frequency'},{symbol:'v',meaning:'speed of sound'},{symbol:'v_o,v_s',meaning:'observer/source speed'}], example:'siren approaching: f′>f' },
  { id:'snell',         topic:'Physics',      name:"Snell's Law (Refraction)",    formula:'n₁ sin θ₁ = n₂ sin θ₂',             variables:[{symbol:'n₁,n₂',meaning:'refractive indices'},{symbol:'θ₁,θ₂',meaning:'angles from normal'}],                                  example:'glass→air: n₁=1.5,θ₁=30° → θ₂≈48.6°' },

  // ── Chemistry ─────────────────────────────────────────────────────────────────
  { id:'ideal-gas',     topic:'Chemistry',    name:'Ideal Gas Law',               formula:'PV = nRT',                            variables:[{symbol:'P',meaning:'pressure'},{symbol:'V',meaning:'volume'},{symbol:'n',meaning:'moles'},{symbol:'R',meaning:'8.314 J/mol·K'},{symbol:'T',meaning:'temp (K)'}], example:'n=1,T=300K,V=1L → P=nRT/V' },
  { id:'molarity',      topic:'Chemistry',    name:'Molarity',                    formula:'M = n / V',                           variables:[{symbol:'M',meaning:'molarity (mol/L)'},{symbol:'n',meaning:'moles'},{symbol:'V',meaning:'volume (L)'}],                       example:'2mol in 0.5L → M=4mol/L',            fn:'(x) => 2/x' },
  { id:'boyle',         topic:'Chemistry',    name:"Boyle's Law",                 formula:'P₁V₁ = P₂V₂',                        variables:[{symbol:'P₁,P₂',meaning:'pressures'},{symbol:'V₁,V₂',meaning:'volumes'}],                                                    example:'P₁=2,V₁=5,P₂=4 → V₂=2.5L' },
  { id:'charles',       topic:'Chemistry',    name:"Charles's Law",               formula:'V₁/T₁ = V₂/T₂',                      variables:[{symbol:'V',meaning:'volume'},{symbol:'T',meaning:'temperature (K)'}],                                                        example:'V₁=3L,T₁=300K,T₂=600K → V₂=6L' },
  { id:'gay-lussac',    topic:'Chemistry',    name:"Gay-Lussac's Law",            formula:'P₁/T₁ = P₂/T₂',                      variables:[{symbol:'P',meaning:'pressure'},{symbol:'T',meaning:'temperature (K)'}],                                                      example:'P₁=1atm,T₁=300K,T₂=600K → P₂=2atm' },
  { id:'dilution',      topic:'Chemistry',    name:'Dilution Formula',            formula:'M₁V₁ = M₂V₂',                        variables:[{symbol:'M',meaning:'molarity'},{symbol:'V',meaning:'volume'}],                                                               example:'12M×5mL=M₂×60mL → M₂=1M' },
  { id:'ph',            topic:'Chemistry',    name:'pH Formula',                  formula:'pH = −log[H⁺]',                       variables:[{symbol:'pH',meaning:'acidity 0–14'},{symbol:'[H⁺]',meaning:'H⁺ concentration (mol/L)'}],                                    example:'[H⁺]=0.001 → pH=3' },
  { id:'poh',           topic:'Chemistry',    name:'pOH Formula',                 formula:'pOH = −log[OH⁻]  ;  pH+pOH=14',      variables:[{symbol:'[OH⁻]',meaning:'hydroxide ion concentration'}],                                                                      example:'[OH⁻]=0.01 → pOH=2, pH=12' },
  { id:'avogadro',      topic:'Chemistry',    name:"Avogadro's Number",           formula:'N = n × Nₐ',                          variables:[{symbol:'N',meaning:'particles'},{symbol:'n',meaning:'moles'},{symbol:'Nₐ',meaning:'6.022×10²³'}],                            example:'1mol H₂O=6.022×10²³ molecules' },
  { id:'percent-yield', topic:'Chemistry',    name:'Percent Yield',               formula:'% yield = (actual / theoretical) × 100', variables:[{symbol:'actual',meaning:'grams obtained'},{symbol:'theoretical',meaning:'grams expected'}],                             example:'actual=8g, theoretical=10g → 80%' },
  { id:'percent-comp',  topic:'Chemistry',    name:'Percent Composition',         formula:'% = (part mass / total) × 100',       variables:[{symbol:'part mass',meaning:'mass of element'},{symbol:'total',meaning:'molar mass of compound'}],                           example:'Na in NaCl: (23/58.5)×100≈39.3%' },
  { id:'gibbs',         topic:'Chemistry',    name:'Gibbs Free Energy',           formula:'ΔG = ΔH − TΔS',                      variables:[{symbol:'ΔH',meaning:'enthalpy change (J)'},{symbol:'T',meaning:'temperature (K)'},{symbol:'ΔS',meaning:'entropy change (J/K)'}], example:'ΔH=−100,T=300,ΔS=−0.2 → ΔG=−40J' },
  { id:'henderson',     topic:'Chemistry',    name:'Henderson-Hasselbalch',       formula:'pH = pKa + log([A⁻]/[HA])',          variables:[{symbol:'pKa',meaning:'-log(Ka)'},{symbol:'[A⁻]',meaning:'base concentration'},{symbol:'[HA]',meaning:'acid concentration'}], example:'pKa=4.74, [A⁻]=[HA] → pH=4.74' },

  // ── Statistics ────────────────────────────────────────────────────────────────
  { id:'mean',          topic:'Statistics',   name:'Arithmetic Mean',             formula:'x̄ = Σxᵢ / n',                        variables:[{symbol:'x̄',meaning:'average'},{symbol:'Σxᵢ',meaning:'sum of values'},{symbol:'n',meaning:'count'}],                        example:'2,4,6,8 → x̄=5' },
  { id:'weighted-mean', topic:'Statistics',   name:'Weighted Mean',               formula:'x̄_w = Σ(wᵢxᵢ) / Σwᵢ',              variables:[{symbol:'wᵢ',meaning:'weight of each value'},{symbol:'xᵢ',meaning:'data values'}],                                            example:'grades 90(w=2),80(w=1) → (180+80)/3≈87' },
  { id:'median-rule',   topic:'Statistics',   name:'Median Position',             formula:'Position = (n+1)/2',                  variables:[{symbol:'n',meaning:'total count of data (sorted)'}],                                                                          example:'n=7 → 4th value is median' },
  { id:'perm',          topic:'Statistics',   name:'Permutations',                formula:'P(n,r) = n! / (n−r)!',                variables:[{symbol:'n',meaning:'total items'},{symbol:'r',meaning:'items arranged'}],                                                    example:'P(5,2)=20' },
  { id:'comb',          topic:'Statistics',   name:'Combinations',                formula:'C(n,r) = n! / (r!(n−r)!)',            variables:[{symbol:'n',meaning:'total items'},{symbol:'r',meaning:'items chosen'}],                                                      example:'C(5,2)=10' },
  { id:'prob',          topic:'Statistics',   name:'Basic Probability',           formula:'P(A) = favorable / total',            variables:[{symbol:'P(A)',meaning:'probability 0–1'},{symbol:'favorable',meaning:'desired outcomes'}],                                   example:'P(heads)=1/2=0.5' },
  { id:'cond-prob',     topic:'Statistics',   name:'Conditional Probability',     formula:'P(A|B) = P(A∩B) / P(B)',             variables:[{symbol:'P(A|B)',meaning:'P of A given B'},{symbol:'P(A∩B)',meaning:'both occur'},{symbol:'P(B)',meaning:'P of B'}],          example:'P(rain|cloudy)=0.6/0.8=0.75' },
  { id:'bayes',         topic:'Statistics',   name:"Bayes' Theorem",              formula:'P(A|B) = P(B|A)P(A) / P(B)',         variables:[{symbol:'P(A|B)',meaning:'posterior probability'},{symbol:'P(B|A)',meaning:'likelihood'},{symbol:'P(A)',meaning:'prior'}],      example:'medical test accuracy' },
  { id:'stdev',         topic:'Statistics',   name:'Standard Deviation',          formula:'σ = √(Σ(xᵢ−x̄)² / n)',               variables:[{symbol:'σ',meaning:'spread'},{symbol:'x̄',meaning:'mean'},{symbol:'n',meaning:'count'}],                                    example:'2,4,4,4,5,5,7,9 → σ=2' },
  { id:'variance',      topic:'Statistics',   name:'Variance',                    formula:'σ² = Σ(xᵢ−x̄)² / n',                variables:[{symbol:'σ²',meaning:'variance'},{symbol:'x̄',meaning:'mean'}],                                                               example:'σ²=4 when σ=2' },
  { id:'zscore',        topic:'Statistics',   name:'Z-Score',                     formula:'z = (x − μ) / σ',                    variables:[{symbol:'z',meaning:'standard scores'},{symbol:'x',meaning:'data value'},{symbol:'μ',meaning:'population mean'},{symbol:'σ',meaning:'std dev'}], example:'x=75,μ=70,σ=5 → z=1' },
  { id:'binomial',      topic:'Statistics',   name:'Binomial Probability',        formula:'P(X=k) = C(n,k) pᵏ (1−p)ⁿ⁻ᵏ',     variables:[{symbol:'n',meaning:'trials'},{symbol:'k',meaning:'successes'},{symbol:'p',meaning:'probability of success'}],                 example:'P(2 heads in 3 flips)=C(3,2)(0.5)²(0.5)¹=0.375' },
  { id:'expected-val',  topic:'Statistics',   name:'Expected Value',              formula:'E(X) = Σ xᵢ P(xᵢ)',                 variables:[{symbol:'xᵢ',meaning:'outcomes'},{symbol:'P(xᵢ)',meaning:'probability of each outcome'}],                                    example:'fair die: E=(1+2+3+4+5+6)/6=3.5' },

  // ── Calculus ──────────────────────────────────────────────────────────────────
  { id:'lim-def',       topic:'Calculus',     name:'Limit Definition of Deriv.',  formula:"f'(x) = lim(h→0) [f(x+h)−f(x)]/h",  variables:[{symbol:"f'(x)",meaning:'derivative'},{symbol:'h',meaning:'infinitesimally small increment'}],                               example:"f(x)=x² → f'(x)=2x" },
  { id:'power-rule',    topic:'Calculus',     name:'Power Rule (Derivative)',      formula:'d/dx [xⁿ] = nxⁿ⁻¹',                 variables:[{symbol:'n',meaning:'exponent'}],                                                                                             example:'d/dx[x³]=3x²',                       fn:'(x) => 3*x*x' },
  { id:'product-rule',  topic:'Calculus',     name:'Product Rule',                formula:"d/dx[fg] = f'g + fg'",               variables:[{symbol:'f,g',meaning:'functions'},{symbol:"f',g'",meaning:'their derivatives'}],                                            example:"d/dx[x²sinx]=2x sinx+x²cosx" },
  { id:'quotient-rule', topic:'Calculus',     name:'Quotient Rule',               formula:"d/dx[f/g] = (f'g − fg') / g²",      variables:[{symbol:'f,g',meaning:'functions (g≠0)'},{symbol:"f',g'",meaning:'derivatives'}],                                            example:"d/dx[sinx/x]=(xcosx−sinx)/x²" },
  { id:'chain-rule',    topic:'Calculus',     name:'Chain Rule',                  formula:"d/dx[f(g(x))] = f'(g(x))·g'(x)",    variables:[{symbol:'f,g',meaning:'composite functions'}],                                                                               example:"d/dx[sin(x²)]=cos(x²)·2x" },
  { id:'integral-pw',   topic:'Calculus',     name:'Power Rule (Integral)',        formula:'∫xⁿ dx = xⁿ⁺¹/(n+1) + C',          variables:[{symbol:'n',meaning:'exponent (n≠−1)'},{symbol:'C',meaning:'constant'}],                                                      example:"∫x² dx=x³/3+C",                      fn:'(x) => x*x*x/3' },
  { id:'int-by-parts',  topic:'Calculus',     name:'Integration by Parts',        formula:"∫u dv = uv − ∫v du",                variables:[{symbol:'u,v',meaning:'functions chosen strategically'}],                                                                      example:"∫x eˣdx = xeˣ − eˣ + C" },
  { id:'fund-thm',      topic:'Calculus',     name:'Fundamental Theorem',         formula:'∫ₐᵇ f(x)dx = F(b) − F(a)',          variables:[{symbol:'F',meaning:'antiderivative of f'},{symbol:'a,b',meaning:'limits of integration'}],                                    example:'∫₀¹ x dx=[x²/2]₀¹=½' },
  { id:'deriv-sin',     topic:'Calculus',     name:'Derivative of sin(x)',        formula:'d/dx[sin x] = cos x',                variables:[{symbol:'x',meaning:'radians'}],                                                                                               example:'slope at x=0 is cos(0)=1',           fn:'(x) => Math.cos(x)' },
  { id:'deriv-cos',     topic:'Calculus',     name:'Derivative of cos(x)',        formula:'d/dx[cos x] = −sin x',               variables:[{symbol:'x',meaning:'radians'}],                                                                                               example:'slope at x=0 is 0',                  fn:'(x) => -Math.sin(x)' },
  { id:'deriv-exp',     topic:'Calculus',     name:'Derivative of eˣ',            formula:'d/dx[eˣ] = eˣ',                     variables:[{symbol:'e',meaning:"Euler's number ≈2.718"}],                                                                                example:'slope of eˣ equals eˣ everywhere',  fn:'(x) => Math.exp(x)' },
  { id:'deriv-ln',      topic:'Calculus',     name:'Derivative of ln(x)',         formula:'d/dx[ln x] = 1/x',                   variables:[{symbol:'x',meaning:'positive real number'}],                                                                                  example:'d/dx[ln4] = 1/4 = 0.25',            fn:'(x) => 1/x' },
  { id:'lhopital',      topic:'Calculus',     name:"L'Hôpital's Rule",            formula:"lim f/g = lim f'/g'  (if 0/0 or ∞/∞)", variables:[{symbol:"f',g'",meaning:'derivatives of f and g'}],                                                                       example:'lim(x→0) sinx/x = cosx/1 = 1' },
  { id:'arc-len-calc',  topic:'Calculus',     name:'Arc Length (Calculus)',        formula:"L = ∫ₐᵇ √(1 + (f'(x))²) dx",       variables:[{symbol:"f'(x)",meaning:'derivative of curve'},{symbol:'a,b',meaning:'limits'}],                                              example:'length of y=x² from 0 to 1' },
  { id:'disk-method',   topic:'Calculus',     name:'Disk Method (Volume)',         formula:'V = π ∫ₐᵇ [f(x)]² dx',              variables:[{symbol:'f(x)',meaning:'radius at each x'},{symbol:'a,b',meaning:'bounds of rotation'}],                                      example:'rotate y=√x from 0 to 4 → V=8π' },

  // ── Finance ───────────────────────────────────────────────────────────────────
  { id:'simple-int',    topic:'Finance',      name:'Simple Interest',             formula:'I = P × r × t',                       variables:[{symbol:'I',meaning:'interest earned'},{symbol:'P',meaning:'principal'},{symbol:'r',meaning:'annual rate'},{symbol:'t',meaning:'time in years'}], example:'P=1000,r=5%,t=2 → I=₱100' },
  { id:'compound-int',  topic:'Finance',      name:'Compound Interest',           formula:'A = P(1 + r/n)ⁿᵗ',                   variables:[{symbol:'A',meaning:'final amount'},{symbol:'P',meaning:'principal'},{symbol:'r',meaning:'annual rate'},{symbol:'n',meaning:'compounds/yr'},{symbol:'t',meaning:'years'}], example:'P=1000,r=5%,n=12,t=3 → A≈₱1161' },
  { id:'future-val',    topic:'Finance',      name:'Future Value',                formula:'FV = PV × (1 + r)ᵗ',                 variables:[{symbol:'FV',meaning:'future value'},{symbol:'PV',meaning:'present value'},{symbol:'r',meaning:'rate per period'},{symbol:'t',meaning:'periods'}], example:'PV=1000,r=10%,t=5 → FV≈1611', fn:'(x) => 1000*Math.pow(1.1,x)' },
  { id:'present-val',   topic:'Finance',      name:'Present Value',               formula:'PV = FV / (1 + r)ᵗ',                 variables:[{symbol:'PV',meaning:'present value'},{symbol:'FV',meaning:'future value'},{symbol:'r',meaning:'discount rate'},{symbol:'t',meaning:'periods'}], example:'FV=1000,r=5%,t=2 → PV≈907' },
  { id:'roi',           topic:'Finance',      name:'Return on Investment',        formula:'ROI = (gain − cost) / cost × 100',    variables:[{symbol:'gain',meaning:'final value of investment'},{symbol:'cost',meaning:'initial investment'}],                            example:'bought=500,sold=750 → ROI=50%' },
  { id:'break-even',    topic:'Finance',      name:'Break-Even Point',            formula:'Q = FC / (P − VC)',                   variables:[{symbol:'Q',meaning:'units to break even'},{symbol:'FC',meaning:'fixed costs'},{symbol:'P',meaning:'price/unit'},{symbol:'VC',meaning:'variable cost/unit'}], example:'FC=10000,P=50,VC=30 → Q=500 units' },
  { id:'depreciation',  topic:'Finance',      name:'Straight-Line Depreciation',  formula:'D = (cost − salvage) / useful life', variables:[{symbol:'D',meaning:'annual depreciation'},{symbol:'cost',meaning:'purchase price'},{symbol:'salvage',meaning:'end value'}],  example:'cost=10000,salvage=1000,life=9yr → D=1000/yr' },

  // ── Biology ───────────────────────────────────────────────────────────────────
  { id:'exp-pop',       topic:'Biology',      name:'Exponential Population Growth',formula:'N(t) = N₀ × eʳᵗ',                  variables:[{symbol:'N₀',meaning:'initial population'},{symbol:'r',meaning:'growth rate'},{symbol:'t',meaning:'time'}],                  example:'N₀=100,r=0.2,t=5 → N≈271',          fn:'(x) => 100*Math.exp(0.2*x)' },
  { id:'logistic-pop',  topic:'Biology',      name:'Logistic Growth',             formula:'dN/dt = rN(1 − N/K)',               variables:[{symbol:'r',meaning:'growth rate'},{symbol:'N',meaning:'population'},{symbol:'K',meaning:'carrying capacity'}],               example:'S-shaped curve approaching K' },
  { id:'hardy-weinberg',topic:'Biology',      name:'Hardy-Weinberg Equilibrium',  formula:'p² + 2pq + q² = 1',                 variables:[{symbol:'p',meaning:'dominant allele frequency'},{symbol:'q',meaning:'recessive allele frequency (p+q=1)'}],                  example:'p=0.6,q=0.4 → 0.36+0.48+0.16=1' },
  { id:'photosynthesis',topic:'Biology',      name:'Photosynthesis (Summary)',    formula:'6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂',    variables:[{symbol:'CO₂',meaning:'carbon dioxide'},{symbol:'H₂O',meaning:'water'},{symbol:'C₆H₁₂O₆',meaning:'glucose'}],               example:'plants convert sunlight to sugar' },
  { id:'respiration',   topic:'Biology',      name:'Cellular Respiration',        formula:'C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ATP', variables:[{symbol:'ATP',meaning:'adenosine triphosphate (energy)'},{symbol:'C₆H₁₂O₆',meaning:'glucose'}],                           example:'1 glucose → ~36–38 ATP' },
  { id:'bmi-formula',   topic:'Biology',      name:'Body Mass Index (BMI)',       formula:'BMI = weight(kg) / height(m)²',      variables:[{symbol:'weight',meaning:'kg'},{symbol:'height',meaning:'meters'}],                                                          example:'70kg, 1.75m → BMI=22.9' },
  { id:'heart-rate',    topic:'Biology',      name:'Max Heart Rate (Est.)',       formula:'HRmax = 220 − age',                  variables:[{symbol:'HRmax',meaning:'maximum beats per minute'},{symbol:'age',meaning:'years'}],                                          example:'age=16 → HRmax=204 bpm',             fn:'(x) => 220 - x' },
  { id:'water-potential',topic:'Biology',     name:'Water Potential',             formula:'Ψ = Ψₛ + Ψₚ',                       variables:[{symbol:'Ψ',meaning:'water potential'},{symbol:'Ψₛ',meaning:'solute potential'},{symbol:'Ψₚ',meaning:'pressure potential'}],   example:'Ψₛ=−3, Ψₚ=2 → Ψ=−1' },
]

const TOPIC_ORDER = ['All','Algebra','Geometry','Trigonometry','Physics','Chemistry','Statistics','Calculus','Finance','Biology']
const TOPICS = TOPIC_ORDER.filter(t => t === 'All' || FORMULAS.some(f => f.topic === t))

// ── GRAPH ENGINE ─────────────────────────────────────────────────────────────
// View transform: screen_x = math_x * scale + ox ; screen_y = -math_y * scale + oy

interface VT { ox: number; oy: number; scale: number }
type DrawTool = 'pen' | 'line' | 'curve'
interface DrawCmd { tool: DrawTool; color: string; size: number; pts: { mx: number; my: number }[] }

const m2s = (mx: number, my: number, v: VT) => ({ x: mx * v.scale + v.ox, y: -my * v.scale + v.oy })
const s2m = (sx: number, sy: number, v: VT) => ({ mx: (sx - v.ox) / v.scale, my: -(sy - v.oy) / v.scale })

function niceStep(scale: number) {
  const raw = 80 / scale
  const exp = Math.floor(Math.log10(raw))
  const base = 10 ** exp
  const n = raw / base
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * base
}

function renderGraph(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  vt: VT,
  formula: Formula | null,
  cmds: DrawCmd[],
) {
  // White background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  const step = niceStep(vt.scale)
  const mxMin = s2m(0, H, vt).mx - step
  const mxMax = s2m(W, 0, vt).mx + step
  const myMin = s2m(0, H, vt).my - step
  const myMax = s2m(0, 0, vt).my + step

  // Minor grid
  ctx.strokeStyle = '#f3f4f6'
  ctx.lineWidth = 1
  for (let gx = Math.ceil(mxMin / step) * step; gx <= mxMax + step * 0.01; gx += step) {
    const sx = m2s(gx, 0, vt).x
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke()
  }
  for (let gy = Math.ceil(myMin / step) * step; gy <= myMax + step * 0.01; gy += step) {
    const sy = m2s(0, gy, vt).y
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke()
  }

  // Axes
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 1.5
  if (vt.ox > 0 && vt.ox < W) { ctx.beginPath(); ctx.moveTo(vt.ox, 0); ctx.lineTo(vt.ox, H); ctx.stroke() }
  if (vt.oy > 0 && vt.oy < H) { ctx.beginPath(); ctx.moveTo(0, vt.oy); ctx.lineTo(W, vt.oy); ctx.stroke() }

  // Axis labels
  ctx.fillStyle = '#9ca3af'
  ctx.font = '10px Inter, sans-serif'
  const ly = Math.max(14, Math.min(vt.oy + 14, H - 5))
  const lx = Math.max(5, Math.min(vt.ox - 5, W - 35))

  ctx.textAlign = 'center'
  for (let gx = Math.ceil(mxMin / step) * step; gx <= mxMax; gx += step) {
    if (Math.abs(gx) < step * 0.01) continue
    const sx = m2s(gx, 0, vt).x
    if (sx > 14 && sx < W - 14) ctx.fillText(String(+gx.toPrecision(5)), sx, ly)
  }
  ctx.textAlign = 'right'
  for (let gy = Math.ceil(myMin / step) * step; gy <= myMax; gy += step) {
    if (Math.abs(gy) < step * 0.01) continue
    const sy = m2s(0, gy, vt).y
    if (sy > 14 && sy < H - 14) ctx.fillText(String(+gy.toPrecision(5)), lx, sy + 3)
  }

  // Formula curve (renders over full visible x range)
  if (formula?.fn) {
    try {
      const fn = new Function('x', `return ${formula.fn.replace(/^\(x\) => /, '')}`) as (x: number) => number
      ctx.strokeStyle = '#16a34a'
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      let started = false
      const N = 900
      for (let i = 0; i <= N; i++) {
        const mx = mxMin + (i / N) * (mxMax - mxMin)
        try {
          const my = fn(mx)
          if (!isFinite(my) || Math.abs(my) > 1e8) { started = false; continue }
          const { x, y } = m2s(mx, my, vt)
          if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y)
        } catch { started = false }
      }
      ctx.stroke()
      ctx.font = 'bold 11px Poppins, sans-serif'
      ctx.fillStyle = '#16a34a'
      ctx.textAlign = 'left'
      ctx.fillText(formula.formula, 10, 20)
    } catch { /* bad fn */ }
  }

  // Drawing commands (math → screen on every render, so they pan/zoom with graph)
  cmds.forEach(cmd => {
    const spts = cmd.pts.map(p => m2s(p.mx, p.my, vt))
    if (spts.length < 2) return
    ctx.strokeStyle = cmd.color
    ctx.lineWidth = cmd.size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (cmd.tool === 'pen') {
      ctx.beginPath(); ctx.moveTo(spts[0].x, spts[0].y)
      spts.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
      ctx.stroke()
    } else if (cmd.tool === 'line') {
      const [a, b] = [spts[0], spts[spts.length - 1]]
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    } else if (cmd.tool === 'curve') {
      const [a, b] = [spts[0], spts[spts.length - 1]]
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 50, b.x, b.y)
      ctx.stroke()
    }
  })
}

// ── MINI INTERACTIVE GRAPH ────────────────────────────────────────────────────
function MiniGraph({ formula, onOpenFull }: { formula: Formula; onOpenFull: () => void }) {
  const wrapRef   = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const vtRef     = useRef<VT>({ ox: 0, oy: 0, scale: 60 })
  const [, forceRender] = useState(0)
  const rerender = () => forceRender(n => n + 1)
  const dragging  = useRef(false)
  const panStart  = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const formulaRef = useRef(formula)
  formulaRef.current = formula

  // Resize + init view
  useEffect(() => {
    const wrap = wrapRef.current; const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const init = () => {
      const { width, height } = wrap.getBoundingClientRect()
      if (width === 0) return
      canvas.width = width; canvas.height = height
      vtRef.current = { ox: width / 2, oy: height / 2, scale: 55 }
      redraw()
    }
    const ro = new ResizeObserver(init)
    ro.observe(wrap)
    init()
    return () => ro.disconnect()
  }, [formula.id]) // reinit when formula changes

  const redraw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    renderGraph(ctx, canvas.width, canvas.height, vtRef.current, formulaRef.current, [])
  }, [])

  // Re-draw when formula prop changes
  useEffect(() => { redraw() }, [formula, redraw])

  // Non-passive wheel for zoom
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const r = canvas.getBoundingClientRect()
      const sx = (e.clientX - r.left) * (canvas.width / r.width)
      const sy = (e.clientY - r.top) * (canvas.height / r.height)
      const factor = e.deltaY < 0 ? 1.14 : 1 / 1.14
      const old = vtRef.current
      const ns = Math.max(5, Math.min(3000, old.scale * factor))
      const f = ns / old.scale
      vtRef.current = { ox: sx - (sx - old.ox) * f, oy: sy - (sy - old.oy) * f, scale: ns }
      redraw()
    }
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => canvas.removeEventListener('wheel', handler)
  }, [redraw])

  const getXY = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!; const r = canvas.getBoundingClientRect()
    const scaleX = canvas.width / r.width, scaleY = canvas.height / r.height
    if ('touches' in e) {
      const t = (e as React.TouchEvent).touches[0] || (e as React.TouchEvent).changedTouches[0]
      return { x: (t.clientX - r.left) * scaleX, y: (t.clientY - r.top) * scaleY }
    }
    return { x: ((e as React.MouseEvent).clientX - r.left) * scaleX, y: ((e as React.MouseEvent).clientY - r.top) * scaleY }
  }

  return (
    <div className="mt-3 rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b border-gray-100">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-poppins font-semibold text-gray-600">Interactive Preview</span>
          <span className="text-[10px] text-gray-400 font-inter hidden sm:inline">· scroll to zoom · drag to pan</span>
        </div>
        <button
          onClick={onOpenFull}
          className="flex items-center gap-1 text-xs text-primary font-poppins font-semibold hover:underline touch-manipulation"
        >
          <BarChart2 className="w-3 h-3" /> Open Full →
        </button>
      </div>
      <div ref={wrapRef} className="relative" style={{ height: 210, cursor: 'grab' }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          onMouseDown={e => {
            dragging.current = true
            const { x, y } = getXY(e)
            panStart.current = { x, y, ox: vtRef.current.ox, oy: vtRef.current.oy }
          }}
          onMouseMove={e => {
            if (!dragging.current) return
            const { x, y } = getXY(e)
            vtRef.current = { ...vtRef.current, ox: panStart.current.ox + x - panStart.current.x, oy: panStart.current.oy + y - panStart.current.y }
            redraw()
          }}
          onMouseUp={() => { dragging.current = false }}
          onMouseLeave={() => { dragging.current = false }}
          onTouchStart={e => {
            e.preventDefault(); dragging.current = true
            const { x, y } = getXY(e)
            panStart.current = { x, y, ox: vtRef.current.ox, oy: vtRef.current.oy }
          }}
          onTouchMove={e => {
            e.preventDefault()
            if (!dragging.current) return
            const { x, y } = getXY(e)
            vtRef.current = { ...vtRef.current, ox: panStart.current.ox + x - panStart.current.x, oy: panStart.current.oy + y - panStart.current.y }
            redraw()
          }}
          onTouchEnd={() => { dragging.current = false }}
        />
      </div>
    </div>
  )
}

// ── FULL GRAPH CANVAS MODAL ───────────────────────────────────────────────────
type ActiveTool = 'pan' | DrawTool

const DRAW_COLORS = ['#111827', '#1d4ed8', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#ec4899']
const TOOL_DEFS: { id: ActiveTool; label: string; icon: React.ReactNode }[] = [
  { id: 'pan',   label: 'Pan',      icon: <Move    className="w-3.5 h-3.5" /> },
  { id: 'pen',   label: 'Freehand', icon: <Pencil  className="w-3.5 h-3.5" /> },
  { id: 'line',  label: 'Line',     icon: <Minus   className="w-3.5 h-3.5" /> },
  { id: 'curve', label: 'Curve',    icon: <TrendingUp className="w-3.5 h-3.5" /> },
]

function GraphCanvasModal({ formula, onClose }: { formula: Formula | null; onClose: () => void }) {
  const wrapRef    = useRef<HTMLDivElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const vtRef      = useRef<VT>({ ox: 0, oy: 0, scale: 80 })
  const [, forceRender] = useState(0)
  const rerender   = () => forceRender(n => n + 1)

  const [tool, setTool]   = useState<ActiveTool>('pan')
  const [color, setColor] = useState(DRAW_COLORS[1])
  const [size, setSize]   = useState(2)
  const [cmds, setCmds]   = useState<DrawCmd[]>([])
  const cmdsRef    = useRef<DrawCmd[]>([])
  const formulaRef = useRef(formula)
  formulaRef.current = formula

  const dragging    = useRef(false)
  const panStart    = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const currentCmd  = useRef<DrawCmd | null>(null)

  // Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Resize canvas
  useEffect(() => {
    const wrap = wrapRef.current; const canvas = canvasRef.current
    if (!wrap || !canvas) return
    let inited = false
    const ro = new ResizeObserver(() => {
      const { width, height } = wrap.getBoundingClientRect()
      if (width === 0) return
      canvas.width = width; canvas.height = height
      if (!inited) {
        inited = true
        vtRef.current = { ox: width / 2, oy: height / 2, scale: 80 }
      }
      redraw()
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, []) // eslint-disable-line

  const redraw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    renderGraph(ctx, canvas.width, canvas.height, vtRef.current, formulaRef.current, cmdsRef.current)
  }, [])

  // Redraw when formula changes
  useEffect(() => { redraw() }, [formula, redraw])

  // Non-passive wheel
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const r = canvas.getBoundingClientRect()
      const sx = (e.clientX - r.left) * (canvas.width / r.width)
      const sy = (e.clientY - r.top) * (canvas.height / r.height)
      const factor = e.deltaY < 0 ? 1.13 : 1 / 1.13
      const old = vtRef.current
      const ns = Math.max(4, Math.min(4000, old.scale * factor))
      const f = ns / old.scale
      vtRef.current = { ox: sx - (sx - old.ox) * f, oy: sy - (sy - old.oy) * f, scale: ns }
      redraw()
      rerender()
    }
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => canvas.removeEventListener('wheel', handler)
  }, [redraw])

  const getXY = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!; const r = canvas.getBoundingClientRect()
    const scaleX = canvas.width / r.width, scaleY = canvas.height / r.height
    if ('touches' in e) {
      const t = (e as React.TouchEvent).touches[0] || (e as React.TouchEvent).changedTouches[0]
      return { x: (t.clientX - r.left) * scaleX, y: (t.clientY - r.top) * scaleY }
    }
    return { x: ((e as React.MouseEvent).clientX - r.left) * scaleX, y: ((e as React.MouseEvent).clientY - r.top) * scaleY }
  }, [])

  const onDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    dragging.current = true
    const { x, y } = getXY(e)
    if (tool === 'pan') {
      panStart.current = { x, y, ox: vtRef.current.ox, oy: vtRef.current.oy }
    } else {
      const { mx, my } = s2m(x, y, vtRef.current)
      currentCmd.current = { tool, color, size, pts: [{ mx, my }] }
    }
  }, [tool, color, size, getXY])

  const onMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging.current) return
    e.preventDefault()
    const { x, y } = getXY(e)
    if (tool === 'pan') {
      vtRef.current = { ...vtRef.current, ox: panStart.current.ox + x - panStart.current.x, oy: panStart.current.oy + y - panStart.current.y }
      redraw()
    } else if (currentCmd.current) {
      const { mx, my } = s2m(x, y, vtRef.current)
      if (tool === 'pen') {
        currentCmd.current.pts.push({ mx, my })
        // Incremental stroke for pen performance
        const canvas = canvasRef.current!; const ctx = canvas.getContext('2d')!
        const pts = currentCmd.current.pts
        if (pts.length >= 2) {
          const prev = m2s(pts[pts.length - 2].mx, pts[pts.length - 2].my, vtRef.current)
          const curr = m2s(mx, my, vtRef.current)
          ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(curr.x, curr.y); ctx.stroke()
        }
      } else {
        // For line/curve: update endpoint and show live preview
        currentCmd.current = { ...currentCmd.current, pts: [currentCmd.current.pts[0], { mx, my }] }
        redraw()
        const canvas = canvasRef.current!; const ctx = canvas.getContext('2d')!
        const spts = currentCmd.current.pts.map(p => m2s(p.mx, p.my, vtRef.current))
        ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
        if (tool === 'line') {
          ctx.beginPath(); ctx.moveTo(spts[0].x, spts[0].y); ctx.lineTo(spts[1].x, spts[1].y); ctx.stroke()
        } else if (tool === 'curve') {
          const [a, b] = [spts[0], spts[1]]
          ctx.beginPath(); ctx.moveTo(a.x, a.y)
          ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 50, b.x, b.y); ctx.stroke()
        }
      }
    }
  }, [tool, color, size, getXY, redraw])

  const onUp = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    if (currentCmd.current && currentCmd.current.pts.length >= 2) {
      cmdsRef.current = [...cmdsRef.current, { ...currentCmd.current }]
      setCmds([...cmdsRef.current])
      redraw()
    }
    currentCmd.current = null
  }, [redraw])

  const undo = () => {
    if (!cmdsRef.current.length) return
    cmdsRef.current = cmdsRef.current.slice(0, -1)
    setCmds([...cmdsRef.current])
    redraw()
  }
  const clearDrawings = () => {
    cmdsRef.current = []; setCmds([]); redraw()
  }
  const zoomBy = (factor: number) => {
    const canvas = canvasRef.current!
    const cx = canvas.width / 2, cy = canvas.height / 2
    const old = vtRef.current
    const ns = Math.max(4, Math.min(4000, old.scale * factor))
    const f = ns / old.scale
    vtRef.current = { ox: cx - (cx - old.ox) * f, oy: cy - (cy - old.oy) * f, scale: ns }
    redraw(); rerender()
  }
  const resetView = () => {
    const canvas = canvasRef.current!
    vtRef.current = { ox: canvas.width / 2, oy: canvas.height / 2, scale: 80 }
    redraw(); rerender()
  }
  const download = () => {
    const canvas = canvasRef.current!
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = formula ? `${formula.name.replace(/\s+/g,'-')}.png` : 'graph.png'
    a.click()
  }

  const cursor = tool === 'pan' ? 'grab' : 'crosshair'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        {/* Title */}
        <div className="flex items-center gap-2 mr-1">
          <BarChart2 className="w-4 h-4 text-primary" />
          <span className="font-poppins font-bold text-gray-800 text-sm">Graph Canvas</span>
          {formula && <span className="text-gray-400 text-xs font-inter hidden md:inline">— {formula.name}</span>}
        </div>

        {/* Tool selector */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1">
          {TOOL_DEFS.map(t => (
            <button
              key={t.id} onClick={() => setTool(t.id)} title={t.label}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-poppins font-semibold transition-all touch-manipulation',
                tool === t.id ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800',
              )}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Colors — only when drawing */}
        {tool !== 'pan' && (
          <div className="flex items-center gap-1.5">
            {DRAW_COLORS.map(c => (
              <button
                key={c} onClick={() => setColor(c)} title={c}
                className={cn('w-5 h-5 rounded-full border-2 transition-all touch-manipulation',
                  color === c ? 'border-gray-500 scale-125 shadow' : 'border-white hover:scale-110')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}

        {/* Brush size — only when drawing */}
        {tool !== 'pan' && (
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1">
            {[1, 2, 4, 7].map(s => (
              <button
                key={s} onClick={() => setSize(s)} title={`${s}px`}
                className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-all touch-manipulation',
                  size === s ? 'bg-white shadow-sm' : 'hover:bg-gray-200')}
              >
                <div className="rounded-full bg-gray-800" style={{ width: Math.min(s * 2 + 2, 14), height: Math.min(s * 2 + 2, 14) }} />
              </button>
            ))}
          </div>
        )}

        {/* Right-side controls */}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => zoomBy(1.3)} title="Zoom In"    className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all touch-manipulation"><ZoomIn   className="w-4 h-4" /></button>
          <button onClick={() => zoomBy(1/1.3)} title="Zoom Out" className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all touch-manipulation"><ZoomOut  className="w-4 h-4" /></button>
          <button onClick={resetView}  title="Reset View"        className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all touch-manipulation"><RotateCcw className="w-4 h-4" /></button>
          {cmds.length > 0 && (
            <>
              <button onClick={undo}          title="Undo"            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all touch-manipulation"><Undo2   className="w-4 h-4" /></button>
              <button onClick={clearDrawings} title="Clear drawings"  className="p-2 rounded-xl text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all touch-manipulation"><Trash2  className="w-4 h-4" /></button>
            </>
          )}
          <button onClick={download} title="Download PNG"         className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all touch-manipulation"><Download className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button onClick={onClose}  title="Close (Esc)"          className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all touch-manipulation"><X        className="w-5 h-5" /></button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div ref={wrapRef} className="flex-1 relative" style={{ cursor }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
        />
        {!formula && cmds.length === 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-white/90 backdrop-blur border border-gray-200 rounded-2xl px-5 py-2.5 shadow-sm">
              <p className="text-xs text-gray-400 font-inter whitespace-nowrap">
                Scroll to zoom · Drag to pan · Pick a drawing tool above to annotate
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function FormulaFinderPage() {
  const [query, setQuery]     = useState('')
  const [topic, setTopic]     = useState('All')
  const [selected, setSelected] = useState<Formula | null>(FORMULAS[0])
  const [graphOpen, setGraphOpen]     = useState(false)
  const [graphFormula, setGraphFormula] = useState<Formula | null>(null)

  const openGraph = (f: Formula | null) => { setGraphFormula(f); setGraphOpen(true) }

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return FORMULAS.filter(f =>
      (topic === 'All' || f.topic === topic) &&
      (!q || f.name.toLowerCase().includes(q) || f.formula.toLowerCase().includes(q) || f.topic.toLowerCase().includes(q)),
    )
  }, [query, topic])

  return (
    <>
      {graphOpen && <GraphCanvasModal formula={graphFormula} onClose={() => setGraphOpen(false)} />}

      <ToolLayout
        title="Formula / Graph Finder"
        subtitle="STEM Quick Reference"
        icon={<Calculator className="w-4 h-4" />}
        fullHeight
        actions={
          <button
            onClick={() => openGraph(null)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-poppins font-semibold rounded-xl hover:bg-primary/90 transition-all touch-manipulation"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open Graph Canvas</span>
            <span className="sm:hidden">Graph</span>
          </button>
        }
      >
        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">

          {/* ── Left: search + formula list ── */}
          <div className="w-full sm:w-72 lg:w-80 flex-shrink-0 flex flex-col border-b sm:border-b-0 sm:border-r border-gray-200 bg-white min-h-0">
            {/* Search */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search formula or topic…"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-inter focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>
            {/* Topic chips */}
            <div className="flex gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none border-b border-gray-100">
              {TOPICS.map(t => (
                <button key={t} onClick={() => setTopic(t)}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-poppins font-semibold whitespace-nowrap transition-all touch-manipulation',
                    topic === t ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                  {t}
                </button>
              ))}
            </div>
            {/* Formula list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Calculator className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm font-inter">No formulas found</p>
                </div>
              )}
              {filtered.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelected(f)}
                  className={cn(
                    'group w-full text-left rounded-xl px-3 py-3 border transition-all duration-150 touch-manipulation',
                    selected?.id === f.id
                      ? 'bg-primary/5 border-primary/25 shadow-sm'
                      : 'border-transparent hover:bg-white hover:border-gray-200 hover:shadow-sm',
                  )}
                >
                  {/* Name + badges row */}
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'font-poppins font-semibold text-sm leading-snug transition-colors',
                        selected?.id === f.id ? 'text-primary' : 'text-gray-800 group-hover:text-gray-900',
                      )}>
                        {f.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-gray-400 font-inter">{f.topic}</span>
                        {f.fn && (
                          <span className="text-[9px] font-poppins font-semibold text-primary/70 bg-primary/8 px-1.5 py-0.5 rounded-full leading-none">
                            GRAPH
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className={cn(
                      'w-3.5 h-3.5 mt-0.5 flex-shrink-0 transition-all duration-150',
                      selected?.id === f.id
                        ? 'text-primary'
                        : 'text-gray-200 group-hover:text-primary/40 group-hover:translate-x-0.5',
                    )} />
                  </div>
                  {/* Formula peek — slides in on hover & always visible when selected */}
                  <p className={cn(
                    'font-mono text-[11px] text-primary/60 truncate transition-all duration-200 overflow-hidden',
                    selected?.id === f.id
                      ? 'max-h-5 mt-1.5 opacity-100'
                      : 'max-h-0 mt-0 opacity-0 group-hover:max-h-5 group-hover:mt-1.5 group-hover:opacity-100',
                  )}>
                    {f.formula}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Right: detail ── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 bg-gray-50">
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Calculator className="w-16 h-16 mb-3 opacity-20" />
                <p className="font-poppins text-lg">Select a formula</p>
              </div>
            ) : (
              <div className="max-w-xl">
                <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-poppins font-semibold rounded-full mb-3">
                  {selected.topic}
                </span>
                <h2 className="text-xl sm:text-2xl font-poppins font-bold text-gray-900 mb-4">{selected.name}</h2>

                {/* Formula box */}
                <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-200 shadow-sm mb-4">
                  <p className="text-xs font-poppins font-semibold text-gray-400 uppercase tracking-wider mb-2">Formula</p>
                  <p className="font-poppins font-bold text-primary text-lg sm:text-2xl leading-snug break-all">{selected.formula}</p>
                </div>

                {/* Variables */}
                <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm mb-4">
                  <p className="text-xs font-poppins font-semibold text-gray-400 uppercase tracking-wider mb-3">Variables</p>
                  <div className="space-y-2">
                    {selected.variables.map((v, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="font-poppins font-bold text-primary text-sm min-w-[72px] mt-0.5">{v.symbol}</span>
                        <span className="font-inter text-sm text-gray-600 flex-1">{v.meaning}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Example */}
                <div className="bg-secondary/10 rounded-2xl p-4 border border-secondary/20 mb-3">
                  <p className="text-xs font-poppins font-semibold text-secondary uppercase tracking-wider mb-1.5">Quick Example</p>
                  <p className="font-inter text-sm text-gray-700 leading-relaxed">{selected.example}</p>
                </div>

                {/* Interactive mini graph (only for formulas that have fn) */}
                {selected.fn && (
                  <MiniGraph formula={selected} onOpenFull={() => openGraph(selected)} />
                )}

                {/* Open in full canvas button */}
                {selected.fn && (
                  <button
                    onClick={() => openGraph(selected)}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-3 bg-gray-900 hover:bg-gray-700 text-white font-poppins font-semibold text-sm rounded-2xl transition-all touch-manipulation"
                  >
                    <BarChart2 className="w-4 h-4 text-green-400" />
                    Open in Graph Canvas
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </ToolLayout>
    </>
  )
}
