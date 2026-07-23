import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OtpInput } from './OtpInput';

function ControlledOtpInput({ onComplete }: { onComplete?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} />;
}

describe('OtpInput', () => {
  it('renders one box per digit', () => {
    render(<ControlledOtpInput />);
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
  });

  it('auto-advances focus to the next box as digits are typed', async () => {
    render(<ControlledOtpInput />);
    const boxes = screen.getAllByRole('textbox');
    await userEvent.click(boxes[0]);
    await userEvent.keyboard('123');
    expect(boxes[0]).toHaveValue('1');
    expect(boxes[1]).toHaveValue('2');
    expect(boxes[2]).toHaveValue('3');
    expect(boxes[3]).toHaveFocus();
  });

  it('moves focus to the previous box on backspace from an empty box', async () => {
    render(<ControlledOtpInput />);
    const boxes = screen.getAllByRole('textbox');
    await userEvent.click(boxes[0]);
    await userEvent.keyboard('12');
    expect(boxes[2]).toHaveFocus();
    await userEvent.keyboard('{Backspace}');
    expect(boxes[1]).toHaveFocus();
  });

  it('fires onComplete exactly once when the final digit is entered', async () => {
    const onComplete = vi.fn();
    render(<ControlledOtpInput onComplete={onComplete} />);
    const boxes = screen.getAllByRole('textbox');
    await userEvent.click(boxes[0]);
    await userEvent.keyboard('123456');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('distributes a pasted code across all boxes', async () => {
    render(<ControlledOtpInput />);
    const boxes = screen.getAllByRole('textbox');
    await userEvent.click(boxes[0]);
    await userEvent.paste('654321');
    boxes.forEach((box, index) => {
      expect(box).toHaveValue('654321'[index]);
    });
  });

  it('disables every box when disabled is set', () => {
    render(
      <OtpInput value="" onChange={() => {}} disabled />
    );
    screen.getAllByRole('textbox').forEach((box) => {
      expect(box).toBeDisabled();
    });
  });
});
