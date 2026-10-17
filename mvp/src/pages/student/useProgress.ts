import { useEffect, useState } from 'react';
import { api, type LessonProgress } from '../../api';

export function useProgress() {
  const [p, setP] = useState<LessonProgress | null>(null);
  const [mastery, setMastery] = useState<Record<string, number>>({});
  const load = () =>
    api
      .me()
      .then((m) => {
        setP(m.lessons);
        setMastery(m.mastery);
      })
      .catch(() => setP({}));
  useEffect(() => {
    load();
  }, []);
  return { p, mastery, reload: load };
}
