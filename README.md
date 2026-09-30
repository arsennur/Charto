# Charto

Hafif, framework bağımsız, SVG tabanlı bar ve line chart kütüphanesi. Sıfır çalışma zamanı bağımlılığı; TypeScript tipleri, sade varsayılanlar ve yumuşak açılış animasyonları.

## Projeyi çalıştır

Node.js 22.18+ kullanın.

```sh
npm install
npm run dev
```

Demo: http://127.0.0.1:5173

```sh
npm run build   # dist/ kütüphane; demo-dist/ demo sitesi
npm test        # Sayısal ölçek, yerleşim ve eğri testleri
npm run check   # TypeScript kontrolü
```

Tarayıcı testleri: geliştirme sunucusu açıkken `/tests/browser.html`. Bar ve line geometrisi, negatif/yığılmış değerler, eksik line noktaları, stil değiştirme, güncelleme, klavye, export, animasyon, yeniden boyutlandırma ve temizleme davranışlarını kontrol eder.

## Başka bir uygulamada kullan

Charto bir JavaScript paketidir. Ayrı bir sunucu veya CDN gerekmez: uygulamanızın build aracı kütüphaneyi uygulama dosyalarına dahil eder.

### Private GitHub reposundan kurulum

Repo: [arsennur/Charto](https://github.com/arsennur/Charto). Repo erişimi olan GitHub hesabınızla Git kimlik doğrulamasını bir kez yapılandırın:

```sh
gh auth login
gh auth setup-git
```

Kullanacağınız uygulamanın klasöründe:

```sh
npm install 'git+https://github.com/arsennur/Charto.git#v0.1.0'
```

Paket adı `charto` olduğu için aşağıdaki import örnekleri aynen geçerlidir. Git kurulumunda `prepare` script'i kütüphaneyi derler; uygulamaya derlenmiş JavaScript ve TypeScript bildirimleri yüklenir. Kurulum sırasında geliştirme araçları indirilir, çalışma zamanında ek bağımlılık gerekmez. Geliştirme ve Git'ten derleme için Node.js 22.18+ kullanın.

Sürüm etiketini ve uygulamanızın lock dosyasını saklayın. Yeni sürüm kullanmak istediğinizde kurulum komutundaki etiketi değiştirin. Private repodan kurulum yapan CI/deploy ortamına da repo okuma erişimi gerekir; token'ı kaynak koduna veya paket URL'sine yazmayın.

### Yerel paket dosyasından kurulum

Paket henüz npm registry'ye yayımlanmadı. GitHub erişimi gerektirmeyen bir `.tgz` dosyası da üretebilirsiniz:

```sh
# Charto klasöründe
npm pack

# Kullanacağınız uygulamada
npm install /absolute/path/to/charto/charto-0.1.0.tgz
```

```html
<div id="chart"></div>
```

```ts
import { barChart } from 'charto';

const chart = barChart('#chart', {
  data: [
    { label: 'Pzt', value: 120 },
    { label: 'Sal', value: 190 },
    { label: 'Çar', value: 160 },
  ],
  color: '#27bd83',
  label: 'Günlük siparişler',
});
```

Build aracı olmayan sayfalarda, `dist/charto.js` dosyasını projenize kopyalayıp `<script type="module">` içinde `import { barChart } from './charto.js'` kullanabilirsiniz. Ek CSS dosyası gerekmez. Kapsayıcının genişliği otomatik izlenir.

### Dağıtım önerisi

- Kendi uygulamalarınız için şimdilik private GitHub reposu ve sürüm etiketleri yeterli.
- Uygulama sayısı arttığında önceden derlenmiş paketleri bir registry'den dağıtabilirsiniz. Private kullanım için GitHub Packages veya private npm paketi; herkese açık dağıtım için public npm paketi kullanılabilir. Bu projede henüz registry yayını yapılandırılmadı.
- Demo sitesi ayrı bir uygulamadır. İsterseniz `demo-dist/` klasörünü statik hosting'e koyabilirsiniz; kütüphaneyi kullanmak için demoyu yayınlamak gerekmez.

`package.json` içindeki `private: true` npm registry'ye yayınlamayı engeller; GitHub veya `.tgz` üzerinden kurulumu engellemez.

Yeni sürüm hazırlarken testleri çalıştırın, `npm version patch` ile sürümü ve etiketi oluşturun, ardından commit ve etiketi GitHub'a gönderin. Örneğin `0.1.0` sonrasında:

```sh
npm test
npm run build
npm version patch
git push origin main --follow-tags
```

Diğer uygulamada `#v0.1.1` etiketiyle yeniden kurun. Yayımladığınız etiketleri değiştirmeyin; her güncellemeyi yeni sürümle paylaşın.

Kurulum mekanizması: [npm Git bağımlılıkları](https://docs.npmjs.com/cli/v11/commands/npm-install/) ve [prepare yaşam döngüsü](https://docs.npmjs.com/cli/v11/using-npm/scripts/).

## Küçük API

`barChart(elementOrSelector, options)` veya `lineChart(elementOrSelector, options)` bir chart oluşturur. İkisinde de gereken tek seçenek `data`. Güncelleme, animasyon tekrarı, export ve temizleme metotları ortaktır.

### Line chart: keskin veya kıvrımlı

```ts
import { lineChart } from 'charto';

const chart = lineChart('#chart', {
  data: [
    { label: 'Pzt', value: 120 },
    { label: 'Sal', value: 190 },
    { label: 'Çar', value: 160 },
    { label: 'Per', value: 230 },
  ],
  curve: 'smooth', // 'linear': düz çizgiler ve keskin köşeler
  color: '#9066f4',
  strokeWidth: 3,
  points: true, // Noktaları gizlemek için false
  label: 'Günlük siparişler',
});

chart.update({ curve: 'linear' });
chart.update({ curve: 'smooth' });
chart.update({ points: false });
```

- `curve: 'linear'` veri noktalarını düz parçalarla birleştirir.
- `curve: 'smooth'` (varsayılan) noktaların içinden geçen yumuşak Bézier eğrileri çizer. Eğri, iki komşu değerin dışına taşmaz.
- `strokeWidth` varsayılan `3` pikseldir; 0'dan büyük, en fazla 20 olabilir.
- `points` varsayılan `true` değerindedir. `false` noktaları gizler; tooltip, klavye gezinmesi ve veri tablosu çalışmaya devam eder. Hem keskin hem kıvrımlı çizgilerde kullanılabilir.
- Açılışta çizgi soldan sağa çizilir. `animate: false` ve sistemin hareketi azaltma tercihi desteklenir.
- `data`, `series`, `color`, `height`, `theme`, `grid`, `labels`, `values`, `label` ve `formatValue` iki chart türünde de kullanılabilir.
- `orientation`, `mode` ve `radius` yalnızca bar chart seçenekleridir.
- Çoklu çizgiler için `value: [120, 80]` ve `series` kullanın. Eksik bir seri değeri veya `value: []` çizgide boşluk bırakır; tablo bu değeri `—` ile gösterir.
- Kategoriler veri sırasıyla, eşit aralıklarla yerleştirilir. `datum.color` yalnızca ilgili noktanın rengini değiştirir; çizginin rengi `series` veya `color` ile belirlenir.

### Bar chart seçenekleri

| Seçenek | Varsayılan | Açıklama |
| --- | --- | --- |
| `data` | Gerekli | `{ label: string, value: number \| number[], color?: string }[]` |
| `series` | Otomatik adlar | `{ name: string, color?: string }[]` |
| `orientation` | `'vertical'` | `'vertical'` veya `'horizontal'` |
| `mode` | `'grouped'` | `'grouped'` veya `'stacked'` |
| `color` | Vivid green | Birinci serinin rengi |
| `theme` | `'light'` | `'light'` veya `'dark'` |
| `height` | `320` | Piksel cinsinden yükseklik; en az 120 |
| `radius` | `5` | Bar köşe yarıçapı; yığılmış barlarda yalnızca dış köşeler |
| `animate` | `true` | Kademeli açılış animasyonu |
| `grid` | `true` | Yardımcı çizgiler; sıfır çizgisi her zaman görünür |
| `labels` | `true` | Kategori etiketleri |
| `values` | `false` | Bar uçlarında değerler |
| `label` | `'Bar chart'` | Erişilebilir chart adı |
| `formatValue` | Otomatik | `(value: number) => string`; eksen, tooltip ve tablo biçimi |
| `onClick` | Yok | `(event: ChartClickEvent) => void`; tıklanan bar, segment veya nokta |

```ts
chart.update({ data: [{ label: 'Pzt', value: 210 }] });
chart.replay();
const svg = chart.toSVG();
chart.destroy();
```

`update()` seçenekleri birleştirir ve açılış animasyonunu yeniden oynatır. Güncellemelerde animasyonu kapatmak için `animate: false` geçin. `destroy()` yalnızca o chart'ın oluşturduğu DOM'u, animasyonlarını ve gözlemcilerini temizler.

### Bar ve nokta tıklamaları

Hem `barChart` hem `lineChart` için `onClick` kullanın:

```ts
const chart = barChart('#chart', {
  data: [{ label: 'Ocak', value: [120, 80] }],
  series: [{ name: 'Organik' }, { name: 'Doğrudan' }],
  mode: 'stacked',
  onClick: ({ label, value, dataIndex, seriesIndex, seriesName, datum, nativeEvent }) => {
    console.log(label, value, dataIndex, seriesIndex, seriesName);
    // Burada seçilen kaydın detayını açabilir veya uygulamanızı filtreleyebilirsiniz.
    console.log(datum, nativeEvent);
  },
});

chart.update({ onClick: event => console.log(event.value) });
chart.update({ onClick: undefined }); // Callback'i kaldırır.
```

- `dataIndex` kategorinin, `seriesIndex` serinin sıfırdan başlayan indeksidir. Tek değerli veride `seriesIndex` 0'dır.
- `value` biçimlendirilmemiş sayıdır; stacked barlarda tıklanan segmentin değeridir.
- `datum` verdiğiniz orijinal veri nesnesidir. `label` kategori adı, `seriesName` yapılandırdığınız seri adıdır. Adsız tek seride `Value`, çoklu seride `Series N` kullanılır.
- `nativeEvent` gerçek tıklama olayını (`MouseEvent`; tarayıcıya göre alt türü `PointerEvent`) veya `KeyboardEvent` nesnesini taşır. Dışarıda tanımlanan callback'ler için `ChartClickEvent` tipini import edebilirsiniz.
- Callback varsa işaretçi el şeklindedir ve veri öğeleri ekran okuyucuya düğme olarak sunulur. Fare, dokunma ve Enter/Space aynı callback'i tetikler.
- `points: false` durumunda da line noktalarının görünmez hedefleri tıklanabilir. Kategori/eksen etiketleri veya chart'ın boş alanı callback'i tetiklemez.
- SVG export statiktir; tıklama davranışı yalnızca canlı chart'ta çalışır.

### Gruplu / yığılmış barlar

```ts
barChart('#chart', {
  data: [
    { label: 'Ocak', value: [120, 80] },
    { label: 'Şubat', value: [160, 110] },
  ],
  series: [
    { name: 'Organik', color: '#27bd83' },
    { name: 'Doğrudan', color: '#9066f4' },
  ],
  mode: 'stacked', // Gruplu görünüm için 'grouped'
  radius: 8, // Dış köşeler yuvarlak, segmentlerin birleşimleri düz
});
```

Negatif değerler sıfırın diğer tarafına çizilir. Yığılmış serilerde pozitif ve negatif toplamlar ayrı tutulur. Eksik seri değerleri tabloda sıfır kabul edilir. Yığılmış barlarda `radius` tüm barın en üst ve en alt dış köşelerini yuvarlatır; yatay barlarda sol ve sağ uçlara uygulanır. Segmentlerin birleşim yerleri düz kalır. Keskin köşeler için `radius: 0` kullanın. `values` bu modda uygulanmaz; her segmentin değeri tooltip ve erişilebilir tabloda bulunur.

### Sayı biçimi

```ts
const currency = new Intl.NumberFormat('tr-TR', {
  style: 'currency', currency: 'TRY', maximumFractionDigits: 0,
});

barChart('#chart', {
  data: [{ label: 'Eylül', value: 48290 }],
  formatValue: value => currency.format(value),
});
```

### React / Vue / diğer frameworkler

Kapsayıcı DOM'a eklendikten sonra chart'ı oluşturun; veri değişince `update()`, bileşen kaldırıldığında `destroy()` çağırın. SSR sırasında yalnızca import edin, `barChart()` çağrısını istemci tarafındaki mount aşamasında yapın.

React örneği:

```tsx
import { useEffect, useRef } from 'react';
import { barChart, type BarChart, type BarDatum } from 'charto';

export function SalesChart({ data }: { data: BarDatum[] }) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<BarChart | null>(null);

  useEffect(() => {
    instance.current = barChart(container.current!, {
      data: [], label: 'Satışlar',
    });
    return () => { instance.current?.destroy(); instance.current = null; };
  }, []);

  useEffect(() => { instance.current?.update({ data }); }, [data]);
  return <div ref={container} />;
}
```

## Davranış ve kapsam

- SVG, Canvas veya başka bir chart motoru gerektirmez.
- Kapsayıcı genişliğine göre ölçeklenir; dar alanlarda kategori etiketlerini seyrekleştirir.
- Tab ile chart'a girilir; ok tuşlarıyla barlar arasında gezilir. Home/End ilk/son bara gider; Escape tooltip'i kapatır.
- Ekran okuyucular için tüm veri bir HTML tablosunda bulunur.
- `prefers-reduced-motion` açıkken animasyon oynatılmaz.
- Export; sabit boyut, sistem fontu ve tema arka planıyla bağımsız SVG üretir.
- Boş veri için boş durum gösterilir; NaN/Infinity ve mutlak değeri 1e100'den büyük sayılar reddedilir.
- Küçük ve orta boy kategori listeleri için tasarlanmıştır. Çok sayıda yatay kategoride `height` değerini artırın.
- Modern tarayıcılarda `ResizeObserver`, SVG ve Web Animations API kullanır. Kütüphane dosyası ağ isteği yapmaz; demo tipografisi Google Fonts kullanır.

Kütüphane kaynakları `src/`, demo `demo/` içindedir. Derleme minify ve gzip boyutlarını ölçer; demo bu ölçümü gösterir. Demo, bağımlılıklar ve araçlar dağıtılan kütüphane dosyasına dahil edilmez.
