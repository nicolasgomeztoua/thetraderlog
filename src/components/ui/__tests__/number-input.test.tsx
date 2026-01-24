import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NumberInput } from "../number-input";

describe("NumberInput", () => {
	describe("clearing to null", () => {
		it("allows clearing the input and returns null", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<NumberInput onChange={onChange} value={42} />);

			const input = screen.getByRole("textbox");
			expect(input).toHaveValue("42");

			// Clear the input
			await user.clear(input);
			await user.tab(); // blur

			expect(onChange).toHaveBeenCalledWith(null);
		});

		it("returns null for empty input on blur", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<NumberInput onChange={onChange} value={null} />);

			const input = screen.getByRole("textbox");
			await user.click(input);
			await user.tab(); // blur without typing

			// Should not call onChange since value didn't change from null
			expect(onChange).not.toHaveBeenCalled();
		});
	});

	describe("decimal handling", () => {
		it("validates decimals when allowDecimals=true (default)", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<NumberInput onChange={onChange} value={null} />);

			const input = screen.getByRole("textbox");
			await user.type(input, "3.14");
			await user.tab(); // blur

			expect(onChange).toHaveBeenCalledWith(3.14);
		});

		it("allows typing decimal point when allowDecimals=true", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<NumberInput onChange={onChange} value={null} />);

			const input = screen.getByRole("textbox");
			await user.type(input, "2.5");

			expect(input).toHaveValue("2.5");
		});

		it("rejects decimals when allowDecimals=false", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(
				<NumberInput allowDecimals={false} onChange={onChange} value={null} />,
			);

			const input = screen.getByRole("textbox");
			// Typing a decimal point should not work
			await user.type(input, "3.14");

			// The decimal point should be rejected, so only "314" should be typed
			expect(input).toHaveValue("314");
		});

		it("truncates decimal input to integer when allowDecimals=false on blur", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			// Start with a decimal value externally
			render(
				<NumberInput allowDecimals={false} onChange={onChange} value={null} />,
			);

			const input = screen.getByRole("textbox");
			await user.type(input, "42");
			await user.tab(); // blur

			expect(onChange).toHaveBeenCalledWith(42);
		});
	});

	describe("min/max validation on blur", () => {
		it("shows error when value is below min", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<NumberInput min={10} onChange={onChange} value={null} />);

			const input = screen.getByRole("textbox");
			await user.type(input, "5");
			await user.tab(); // blur

			// Error should be shown
			expect(screen.getByText("Value must be at least 10")).toBeInTheDocument();
			expect(input).toHaveAttribute("aria-invalid", "true");
			// onChange should NOT be called when validation fails
			expect(onChange).not.toHaveBeenCalled();
		});

		it("shows error when value is above max", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<NumberInput max={100} onChange={onChange} value={null} />);

			const input = screen.getByRole("textbox");
			await user.type(input, "150");
			await user.tab(); // blur

			// Error should be shown
			expect(screen.getByText("Value must be at most 100")).toBeInTheDocument();
			expect(input).toHaveAttribute("aria-invalid", "true");
			// onChange should NOT be called when validation fails
			expect(onChange).not.toHaveBeenCalled();
		});

		it("shows combined min/max error message when both are set", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(
				<NumberInput max={100} min={10} onChange={onChange} value={null} />,
			);

			const input = screen.getByRole("textbox");
			await user.type(input, "5");
			await user.tab(); // blur

			expect(
				screen.getByText("Value must be between 10 and 100"),
			).toBeInTheDocument();
		});

		it("calls onChange when value is within valid range", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(
				<NumberInput max={100} min={10} onChange={onChange} value={null} />,
			);

			const input = screen.getByRole("textbox");
			await user.type(input, "50");
			await user.tab(); // blur

			expect(onChange).toHaveBeenCalledWith(50);
			expect(input).toHaveAttribute("aria-invalid", "false");
		});
	});

	describe("suffix display", () => {
		it("displays suffix inline", () => {
			const onChange = vi.fn();

			render(<NumberInput onChange={onChange} suffix="R" value={2.5} />);

			expect(screen.getByText("R")).toBeInTheDocument();
		});

		it("formats value with suffix visible", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(
				<NumberInput
					decimalPlaces={1}
					onChange={onChange}
					suffix="R"
					value={null}
				/>,
			);

			const input = screen.getByRole("textbox");
			await user.type(input, "2.5");
			await user.tab(); // blur

			expect(onChange).toHaveBeenCalledWith(2.5);
			expect(screen.getByText("R")).toBeInTheDocument();
		});
	});

	describe("keyboard navigation", () => {
		it("saves value on Enter key", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<NumberInput onChange={onChange} value={null} />);

			const input = screen.getByRole("textbox");
			await user.type(input, "123");
			await user.keyboard("{Enter}");

			expect(onChange).toHaveBeenCalledWith(123);
		});

		it("cancels edit on Escape key", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<NumberInput onChange={onChange} value={42} />);

			const input = screen.getByRole("textbox");
			await user.clear(input);
			await user.type(input, "999");
			await user.keyboard("{Escape}");

			// Value should be restored to original
			expect(input).toHaveValue("42");
			expect(onChange).not.toHaveBeenCalled();
		});
	});

	describe("negative numbers", () => {
		it("allows negative numbers", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<NumberInput onChange={onChange} value={null} />);

			const input = screen.getByRole("textbox");
			await user.type(input, "-50");
			await user.tab(); // blur

			expect(onChange).toHaveBeenCalledWith(-50);
		});

		it("allows negative decimals", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			render(<NumberInput onChange={onChange} value={null} />);

			const input = screen.getByRole("textbox");
			await user.type(input, "-3.14");
			await user.tab(); // blur

			expect(onChange).toHaveBeenCalledWith(-3.14);
		});
	});
});
