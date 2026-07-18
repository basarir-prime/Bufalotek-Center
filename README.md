# Bufalotek Center

Bilişim Topluluğu için toplantı log tutma ve takip web sitesi.
React + Firebase (Firestore + Authentication) tabanlı, rol-bazlı yetkilendirme sistemi ile.

GitHub Pages üzerinden otomatik dağıtım yapılır — `main` dalına her push yaptığında GitHub Actions projeyi derleyip GitHub Pages'te yayımlar.

## Özellikler

- **Rol Bazlı Yetki**: Admin (tam yetki) ve User (sadece okuma). Admin, kullanıcılara "bugün sen log tutabilirsin" izni verebilir.
- **Toplantı Logları**: Her toplantı 3 kategoride kaydedilir — Gündem, Alınan Kararlar, Görevler.
- **Yoklama Sistemi**: Toplantıya gelen üyeleri "Geldi/Gelmedi" olarak işaretleme, yeşil/kırmızı görsel geri bildirim.
- **Gri Liste**: Son 3 toplantıya üst üste katılmayan üyeler otomatik gri listeye alınır.
- **Koyu Tema**: Modern, bilişim topluluğuna uygun koyu tema (neon mavi/mor).
- **Takvim Görünümü**: Toplantılar aylık takvim formatında.
- **Firebase Entegrasyonu**: Birden çok kullanıcı aynı anda log tutabilir.

## GitHub Secrets (Zorunlu)

Repository'yi oluşturduktan sonra **Settings → Secrets and variables → Actions → New repository secret** ile şu 6 secret'i ekleyin:

| Secret Adı | Değer |
|------------|-------|
| `FIREBASE_API_KEY` | Firebase Console > Project Settings > API Key |
| `FIREBASE_AUTH_DOMAIN` | `proje-id.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | Firebase proje ID |
| `FIREBASE_STORAGE_BUCKET` | `proje-id.appspot.com` |
| `FIREBASE_MESSAGING_SENDER_ID` | Sender ID (Firebase Console > Project Settings) |
| `FIREBASE_APP_ID` | App ID (Firebase Console > Project Settings > Your apps) |

## İlk Kurulum

### 1. Firebase Console Üzerinde

1. [Firebase Console](https://console.firebase.google.com)'da yeni bir proje oluştur.
2. **Authentication** sekmesinden **Email/Password** sağlayıcısını etkinleştir.
3. **Firestore Database**'i başlat (production ya da test mode'da fark etmez, kendi rules'umuzu yazacağız).
4. **Project Settings → Your apps → Web App** ekleyip SDK config'i al (npm seçeneği).
5. Yukarıdaki GitHub Secrets'a bu değerleri gir.
6. **Firestore Database → Rules** sekmesine git, `firestore.rules` dosyasının içeriğini yapıştır, **Publish** et.

### 2. İlk Admin Kullanıcı

1. Yayına aldıktan sonra siteye git, kayıt ol (istediğin e-posta/şifre).
2. **Firebase Console → Firestore Database → users** koleksiyonuna gir.
3. Senin kullanıcının dokümanına `role` alanı ekle, değer olarak `"admin"` yaz.
4. Siteden çıkış yapıp tekrar giriş yap → "Admin Paneli" sekmesi görünür.

Alternatif olarak **Authentication → Kullanıcı → Custom claims** kısmına `{"role": "admin"}` de ekleyebilirsin (Cloud Functions gerektirir).

## Local Geliştirme

```bash
# 1. .env dosyasını oluştur (değerleri Firebase Console'dan al)
cp .env.example .env
# .env içine kendi Firebase değerlerini gir

# 2. Bağımlılıkları yükle
npm install

# 3. Geliştirme sunucusunu başlat
npm start
```

PowerShell'de script çalıştırma politikası engelliyorsa `cmd /c "npm install"` şeklinde çalıştır.

## Dağıtım

Otomatik dağıtım GitHub Actions ile yapılır. `main` (veya `master`) dalına push yapman yeterli — gerisini workflow halleder.

Repository ayarlarında: **Settings → Pages → Build and deployment → Source: GitHub Actions** seçili olmalıdır.

## Klasör Yapısı

```
bufalotek-center/
├── public/                # Statik dosyalar
├── src/
│   ├── firebaseConfig.js   # Firebase SDK yapılandırması (env değişkenleri)
│   ├── firestoreService.js # Firestore CRUD + Auth + Permissions
│   ├── authContext.js      # React context ile auth durumu
│   ├── storageService.js   # Eski localStorage servisi (referans için)
│   ├── App.js              # Ana uygulama bileşeni
│   └── index.css           # Standart CSS (koyu tema)
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions workflow
├── firestore.rules         # Firestore güvenlik kuralları
├── .env.example            # Örnek env dosyası
└── package.json
```

## Güvenlik Notları

- `.env` dosyası `.gitignore`'a eklenmiştir, **asla repository'e pushlamayın**.
- `firestore.rules` kuralları:
  - Sadece giriş yapmış kullanıcılar okuyabilir.
  - Sadece admin'ler silebilir veya rol atayabilir.
  - Admin'in izin verdiği kullanıcılar sadece o gün için yazma yapabilir.
