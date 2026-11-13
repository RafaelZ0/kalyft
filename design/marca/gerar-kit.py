"""Gera os originais vetoriais da identidade C, sem fontes externas."""
from pathlib import Path

OUT = Path(__file__).resolve().parent
RED, INK, PAPER = '#C83C32', '#202321', '#F7F5F2'
SYMBOL = '''<path d="M0 222V102C0 42 49 0 112 0H205C205 100 116 143 0 222Z"/>
<path d="M148 170 264 32C285 7 303 0 334 0H369C400 0 406 20 390 53 347 141 252 175 148 170Z"/>
<path d="M87 195C122 228 170 270 192 314 201 331 205 347 205 360H103C41 360 0 337 0 290 0 254 35 224 87 195Z"/>
<path d="M148 192C245 181 314 220 373 294 414 345 405 360 364 360H294C268 360 252 345 234 323Z"/>'''
# Letreiramento geométrico original, convertido em contornos; não depende de fonte instalada.
WORD = '''<path d="M0 0H24V57L72 0H102L45 66 106 140H74L24 79V140H0Z"/>
<path fill-rule="evenodd" d="M160 36C129 36 110 58 110 90S129 144 160 144C174 144 185 139 193 130V140H216V40H193V50C185 41 174 36 160 36ZM164 59C182 59 194 71 194 90S182 121 164 121 134 109 134 90 146 59 164 59Z"/>
<path d="M238 0H262V140H238Z"/>
<path d="M278 40H304L333 108 360 40H386L327 183H301L320 138Z"/>
<path d="M405 140V62H390V40H405V30C405 8 419-5 441-5 450-5 457-3 464 0V22C458 19 454 18 449 18 436 18 429 23 429 34V40H459V62H429V140Z"/>
<path d="M484 12H508V40H537V62H508V105C508 118 514 122 524 122 529 122 534 121 539 119V140C533 143 525 144 517 144 494 144 484 133 484 110V62H470V40H484Z"/>'''

def svg(name, w, h, content):
    (OUT / name).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="Kalyft"><title>Kalyft</title>{content}</svg>\n', encoding='utf-8', newline='\n')

for name, color in [('vermelho', RED), ('branco', '#FFFFFF'), ('preto', '#000000')]:
    svg(f'simbolo-{name}.svg', 400, 360, f'<g fill="{color}">{SYMBOL}</g>')
for name, symbol, word in [('claro', RED, INK), ('escuro', '#FFFFFF', '#FFFFFF'), ('monocromatico', '#000000', '#000000')]:
    svg(f'logo-{name}.svg', 1160, 360, f'<g fill="{symbol}">{SYMBOL}</g><g fill="{word}" transform="translate(466 85) scale(1.24)">{WORD}</g>')
svg('icone-app.svg', 512, 512, f'<rect width="512" height="512" rx="112" fill="{RED}"/><g fill="#FFFFFF" transform="translate(96 112) scale(.8)">{SYMBOL}</g>')
svg('icone-maskable.svg', 512, 512, f'<path fill="{RED}" d="M0 0H512V512H0Z"/><g fill="#FFFFFF" transform="translate(116 130) scale(.7)">{SYMBOL}</g>')
svg('favicon.svg', 40, 40, f'<rect width="40" height="40" rx="9" fill="{RED}"/><g fill="#FFFFFF" transform="translate(6 7.4) scale(.07)">{SYMBOL}</g>')
# Prancha de revisão dos arquivos de produção, distinta da imagem conceitual.
content = f'<path fill="{PAPER}" d="M0 0H1400V1040H0Z"/>'
content += f'<g transform="translate(120 90)" fill="{RED}">{SYMBOL}</g><g transform="translate(570 190) scale(1.25)" fill="{INK}">{WORD}</g>'
content += f'<rect x="80" y="520" width="920" height="290" rx="24" fill="{INK}"/><g transform="translate(125 565) scale(.55)" fill="white">{SYMBOL}</g><g transform="translate(390 600)" fill="white">{WORD}</g>'
content += f'<rect x="1050" y="520" width="270" height="290" rx="54" fill="{RED}"/><g transform="translate(1085 575) scale(.5)" fill="white">{SYMBOL}</g>'
for x, scale in [(100, .25), (270, .16), (390, .10), (480, .06)]:
    content += f'<g transform="translate({x} 900) scale({scale})" fill="{RED}">{SYMBOL}</g>'
svg('prancha-vetorial.svg', 1400, 1040, content)
print('Gerados 10 SVGs, incluindo prancha vetorial, em', OUT)
