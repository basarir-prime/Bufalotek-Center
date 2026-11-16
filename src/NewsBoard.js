import React, { useState } from 'react';

const getCreatedAt = (value) => {
  if (value?.toDate) return value.toDate();
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const NewsBoard = ({
  news,
  departments,
  canPublish = false,
  canDelete,
  loadError = '',
  onPublish,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!title.trim() || !body.trim()) {
      setError('Haber başlığı ve içeriği zorunludur.');
      return;
    }

    setSaving(true);
    try {
      await onPublish({ title, body });
      setTitle('');
      setBody('');
    } catch (publishError) {
      setError(`Haber yayımlanamadı: ${publishError?.message || 'Bilinmeyen bir hata oluştu.'}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteArticle = async (item) => {
    setError('');
    try {
      await onDelete(item);
    } catch (deleteError) {
      setError(`Haber silinemedi: ${deleteError?.message || 'Bilinmeyen bir hata oluştu.'}`);
    }
  };

  return (
    <div className="news-board">
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {canPublish && (
        <form className="news-composer" onSubmit={submit}>
          <div className="news-composer-heading">
            <span className="news-composer-mark" aria-hidden="true">✦</span>
            <div>
              <h3>Haber paylaş</h3>
              <p>Departman haberleri genel haber akışında da görünür.</p>
            </div>
          </div>
          <label className="news-field-label" htmlFor="news-title">Başlık</label>
          <input
            id="news-title"
            className="news-input"
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Haber başlığı"
          />
          <label className="news-field-label" htmlFor="news-body">İçerik</label>
          <textarea
            id="news-body"
            className="news-input news-textarea"
            maxLength={5000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Toplulukla paylaşmak istediğiniz gelişmeleri yazın..."
            rows={4}
          />
          <div className="news-composer-footer">
            <span>{body.length}/5000</span>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Yayımlanıyor...' : 'Haberi yayımla'}
            </button>
          </div>
        </form>
      )}

      {news.length === 0 ? (
        <p className="empty-msg">Henüz haber paylaşılmamış.</p>
      ) : (
        <div className="news-list">
          {news.map((item) => {
            const department = departments.find((entry) => String(entry.id) === String(item.departmentId));
            const createdAt = getCreatedAt(item.createdAt);
            return (
              <article className="news-card" key={item.id}>
                <div className="news-card-meta">
                  <span className={`news-tag ${department ? 'news-tag-department' : ''}`}>
                    {department?.name || 'Genel'}
                  </span>
                  {createdAt && (
                    <time dateTime={createdAt.toISOString()}>
                      {createdAt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </time>
                  )}
                  {canDelete?.(item) && (
                    <button className="btn btn-sm btn-danger" type="button" onClick={() => deleteArticle(item)}>
                      Haberi sil
                    </button>
                  )}
                </div>
                <h3>{item.title}</h3>
                <p className="news-card-body">{item.body}</p>
                <p className="news-author">{item.authorName || 'Topluluk'}</p>
              </article>
            );
          })}
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
};

export default NewsBoard;
