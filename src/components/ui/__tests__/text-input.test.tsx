import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TextInput } from "../text-input";

describe("TextInput", () => {
	describe("null handling", () => {
		it("returns null for empty string on blur", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<TextInput onChange={onChange} value="hello" />);

			const input = screen.getByRole("textbox");
			await user.clear(input);
			await user.tab(); // blur

			expect(onChange).toHaveBeenCalledWith(null);
		});

		it("returns null for whitespace-only string on blur", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<TextInput onChange={onChange} value={null} />);

			const input = screen.getByRole("textbox");
			await user.type(input, "   ");
			await user.tab(); // blur

			// Whitespace should be trimmed, resulting in null
			expect(onChange).toHaveBeenCalledWith(null);
		});

		it("trims whitespace from values", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<TextInput onChange={onChange} value={null} />);

			const input = screen.getByRole("textbox");
			await user.type(input, "  hello world  ");
			await user.tab(); // blur

			expect(onChange).toHaveBeenCalledWith("hello world");
		});

		it("does not call onChange when value is unchanged", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<TextInput onChange={onChange} value={null} />);

			const input = screen.getByRole("textbox");
			await user.click(input);
			await user.tab(); // blur without typing

			// Should not call onChange since value didn't change from null
			expect(onChange).not.toHaveBeenCalled();
		});
	});

	describe("required validation", () => {
		it("shows error on blur when required and empty", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<TextInput onChange={onChange} required value={null} />);

			const input = screen.getByRole("textbox");
			await user.click(input);
			await user.tab(); // blur without typing

			expect(screen.getByText("This field is required")).toBeInTheDocument();
			expect(input).toHaveAttribute("aria-invalid", "true");
		});

		it("shows error when required field is cleared", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<TextInput onChange={onChange} required value="hello" />);

			const input = screen.getByRole("textbox");
			await user.clear(input);
			await user.tab(); // blur

			expect(screen.getByText("This field is required")).toBeInTheDocument();
			expect(input).toHaveAttribute("aria-invalid", "true");
			// onChange should NOT be called when validation fails
			expect(onChange).not.toHaveBeenCalled();
		});

		it("does not show error when required field has value", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<TextInput onChange={onChange} required value={null} />);

			const input = screen.getByRole("textbox");
			await user.type(input, "valid text");
			await user.tab(); // blur

			expect(
				screen.queryByText("This field is required"),
			).not.toBeInTheDocument();
			expect(input).toHaveAttribute("aria-invalid", "false");
			expect(onChange).toHaveBeenCalledWith("valid text");
		});

		it("clears error when user starts typing", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<TextInput onChange={onChange} required value={null} />);

			const input = screen.getByRole("textbox");
			// First trigger error
			await user.click(input);
			await user.tab();
			expect(screen.getByText("This field is required")).toBeInTheDocument();

			// Then start typing
			await user.click(input);
			await user.type(input, "a");

			// Error should be cleared
			expect(
				screen.queryByText("This field is required"),
			).not.toBeInTheDocument();
		});
	});

	describe("external error prop", () => {
		it("displays external error message", () => {
			const onChange = vi.fn();

			render(
				<TextInput error="Custom error" onChange={onChange} value="test" />,
			);

			expect(screen.getByText("Custom error")).toBeInTheDocument();
			expect(screen.getByRole("textbox")).toHaveAttribute(
				"aria-invalid",
				"true",
			);
		});

		it("clears external error when user starts typing", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(
				<TextInput error="Custom error" onChange={onChange} value="test" />,
			);

			expect(screen.getByText("Custom error")).toBeInTheDocument();

			const input = screen.getByRole("textbox");
			await user.type(input, "x");

			expect(screen.queryByText("Custom error")).not.toBeInTheDocument();
		});
	});

	describe("keyboard navigation", () => {
		it("saves value on Enter key", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<TextInput onChange={onChange} value={null} />);

			const input = screen.getByRole("textbox");
			await user.type(input, "hello");
			await user.keyboard("{Enter}");

			expect(onChange).toHaveBeenCalledWith("hello");
		});

		it("cancels edit on Escape key", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<TextInput onChange={onChange} value="original" />);

			const input = screen.getByRole("textbox");
			await user.clear(input);
			await user.type(input, "new value");
			await user.keyboard("{Escape}");

			// Value should be restored to original
			expect(input).toHaveValue("original");
			expect(onChange).not.toHaveBeenCalled();
		});
	});

	describe("label rendering", () => {
		it("renders label when provided", () => {
			const onChange = vi.fn();

			render(<TextInput label="Name" onChange={onChange} value={null} />);

			expect(screen.getByText("Name")).toBeInTheDocument();
			// Label should be associated with input
			const input = screen.getByRole("textbox");
			const label = screen.getByText("Name");
			expect(label).toHaveAttribute("for", input.id);
		});
	});

	describe("disabled state", () => {
		it("disables input when disabled prop is true", () => {
			const onChange = vi.fn();

			render(<TextInput disabled onChange={onChange} value="test" />);

			expect(screen.getByRole("textbox")).toBeDisabled();
		});
	});
});
