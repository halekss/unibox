"use client";

// Checks/unchecks every email checkbox of the enclosing form.
export function SelectAll() {
  return (
    <label className="selectall">
      <input
        type="checkbox"
        defaultChecked
        onChange={(ev) => {
          for (const box of ev.currentTarget.form!.querySelectorAll<HTMLInputElement>('input[name="ids"]'))
            box.checked = ev.currentTarget.checked;
        }}
      />
      Tout cocher
    </label>
  );
}
