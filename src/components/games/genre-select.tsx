'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GAME_GENRES } from '@/lib/game-genre';

const NONE = '__none';

interface GenreSelectProps {
  id?: string;
  value: string;
  onChange: (genre: string) => void;
}

/** 게임 장르 선택 — 스토어 URL 로 자동 채워지고, 직접 바꿀 수도 있음 ('' = 미지정) */
export function GenreSelect({ id, value, onChange }: GenreSelectProps) {
  // 스토어에서 받아온 값이 목록에 없을 수도 있음 (앱스토어 전용 장르 등) → 그대로 보여줌
  const options =
    value && !(GAME_GENRES as readonly string[]).includes(value)
      ? [...GAME_GENRES, value]
      : GAME_GENRES;
  return (
    <Select
      value={value || NONE}
      onValueChange={(v) => onChange(v === NONE ? '' : v)}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder='장르 선택' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE} className='text-muted-foreground'>
          미지정
        </SelectItem>
        {options.map((genre) => (
          <SelectItem key={genre} value={genre}>
            {genre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
