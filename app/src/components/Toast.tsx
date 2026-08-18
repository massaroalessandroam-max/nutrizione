import { CheckIcon } from '../icons';

export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="nm-toast">
      <CheckIcon />
      {message}
    </div>
  );
}
