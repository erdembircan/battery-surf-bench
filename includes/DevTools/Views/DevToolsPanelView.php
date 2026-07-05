<?php
/**
 * Dev-tools panel view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\DevTools\Views;

use ErdemBircan\BatterySurfBench\Support\View;

use function esc_attr;
use function esc_html;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the floating dev-tools widget: a collapsed "DEV" pill that swaps —
 * mutually exclusive, never both on screen — into a coastal field card with
 * one bounded sub-panel per tool: Battery (the override) and Discharge (the
 * simulation that drives it). A third tool is another group in the card
 * body, not a rework.
 *
 * The battery group has no enable switch: every control already carries its
 * own explicit off-state (the charging tri-state's "System" choice, the
 * level row's "System" button), so there is nothing left for a master switch
 * to gate — a control is either following the system or overriding it, with
 * no third "armed but nothing set" state in between.
 *
 * The discharge group is purely a driver of the battery group's own level
 * override — it has no seam of its own. While it is running, every other
 * battery-related control (the charging tri-state, the level row, and the
 * sim's own steppers) is disabled; only Stop stays live. This muting is
 * legitimate — gated by a genuinely running process — unlike the removed
 * enable switches, which gated nothing real.
 *
 * The card header divides into exactly three zones: the title (the eyebrow),
 * the override status (the armed indicator), and a panel-buttons container
 * (`.bsb-devtools__card-actions`) holding Reset then Close. Reset is the
 * panel's one cross-cutting escape hatch — it clears every override at once,
 * including stopping a running sim — rendered as an icon-only control (its
 * accessible name lives in `aria-label`, matching Close) and stays enabled
 * the whole time: unlike the battery group's own controls, it is never
 * disabled while a sim runs, since stopping the sim is exactly what it is
 * there to do.
 *
 * The panel sits outside the `bsb/cockpit` block, so it carries its own
 * `data-wp-interactive="bsb/cockpit"` region but has no cockpit context — every
 * binding below reads shared `state` (never a `getContext()`-derived getter),
 * and every member it reads or writes carries the `devtools` prefix so it can
 * never collide with a production store member. It is escaped and pre-rendered
 * here, then interpolated as trusted markup by whichever surface (the cockpit
 * dashboard, the session detail screen) places it via the
 * `battery_surf_bench_devtools_panel` filter.
 */
class DevToolsPanelView implements View {

	/**
	 * Renders the panel body.
	 *
	 * @param array<string, mixed> $data {
	 *     Raw (translated) labels.
	 *
	 *     @type string $dev_label              Raw label on the collapsed pill.
	 *     @type string $eyebrow_label           Raw card header eyebrow.
	 *     @type string $armed_label             Raw "override active" header text.
	 *     @type string $reset_label             Raw accessible label for the panel-wide reset control.
	 *     @type string $close_label             Raw accessible label for the close control.
	 *     @type string $battery_label           Raw battery group heading.
	 *     @type string $charging_group_label    Raw accessible group label for the charging tri-state.
	 *     @type string $system_label            Raw label for the "follow system" choice, reused by both the charging tri-state and the level row.
	 *     @type string $charging_label          Raw label for the "force charging" choice.
	 *     @type string $discharging_label       Raw label for the "force discharging" choice.
	 *     @type string $level_label             Raw accessible label for the level-override slider.
	 *     @type string $discharge_label         Raw discharge group heading.
	 *     @type string $from_label              Raw label for the start-percentage stepper.
	 *     @type string $from_decrease_label     Raw accessible label for decreasing the start percentage.
	 *     @type string $from_increase_label     Raw accessible label for increasing the start percentage.
	 *     @type string $to_label                Raw label for the end-percentage stepper.
	 *     @type string $to_decrease_label       Raw accessible label for decreasing the end percentage.
	 *     @type string $to_increase_label        Raw accessible label for increasing the end percentage.
	 *     @type string $duration_label          Raw label for the duration stepper.
	 *     @type string $duration_decrease_label Raw accessible label for decreasing the duration.
	 *     @type string $duration_increase_label Raw accessible label for increasing the duration.
	 *     @type string $percent_unit_label      Raw unit label for the From/To steppers.
	 *     @type string $minutes_unit_label      Raw unit label for the duration stepper.
	 *     @type string $start_label             Raw label for the sim's Start state.
	 *     @type string $stop_label              Raw label for the sim's Stop state.
	 * }
	 * @return string The panel markup.
	 */
	public function render( array $data = array() ): string {
		$dev               = esc_html( (string) ( $data['dev_label'] ?? '' ) );
		$eyebrow           = esc_html( (string) ( $data['eyebrow_label'] ?? '' ) );
		$armed             = esc_html( (string) ( $data['armed_label'] ?? '' ) );
		$reset             = esc_attr( (string) ( $data['reset_label'] ?? '' ) );
		$close             = esc_attr( (string) ( $data['close_label'] ?? '' ) );
		$battery           = esc_html( (string) ( $data['battery_label'] ?? '' ) );
		$charging_group    = esc_attr( (string) ( $data['charging_group_label'] ?? '' ) );
		$system            = esc_html( (string) ( $data['system_label'] ?? '' ) );
		$charging_choice   = esc_html( (string) ( $data['charging_label'] ?? '' ) );
		$discharging       = esc_html( (string) ( $data['discharging_label'] ?? '' ) );
		$level             = esc_attr( (string) ( $data['level_label'] ?? '' ) );
		$discharge         = esc_html( (string) ( $data['discharge_label'] ?? '' ) );
		$from              = esc_html( (string) ( $data['from_label'] ?? '' ) );
		$from_decrease     = esc_attr( (string) ( $data['from_decrease_label'] ?? '' ) );
		$from_increase     = esc_attr( (string) ( $data['from_increase_label'] ?? '' ) );
		$to                = esc_html( (string) ( $data['to_label'] ?? '' ) );
		$to_decrease       = esc_attr( (string) ( $data['to_decrease_label'] ?? '' ) );
		$to_increase       = esc_attr( (string) ( $data['to_increase_label'] ?? '' ) );
		$duration          = esc_html( (string) ( $data['duration_label'] ?? '' ) );
		$duration_decrease = esc_attr( (string) ( $data['duration_decrease_label'] ?? '' ) );
		$duration_increase = esc_attr( (string) ( $data['duration_increase_label'] ?? '' ) );
		$percent_unit      = esc_html( (string) ( $data['percent_unit_label'] ?? '' ) );
		$minutes_unit      = esc_html( (string) ( $data['minutes_unit_label'] ?? '' ) );
		$start             = esc_html( (string) ( $data['start_label'] ?? '' ) );
		$stop              = esc_html( (string) ( $data['stop_label'] ?? '' ) );

		return <<<HTML
<div class="bsb-devtools" data-wp-interactive="bsb/cockpit" data-wp-watch---devtools-persist="callbacks.devtoolsPersist">
	<div class="bsb-devtools__swap">
		<button type="button" class="bsb-devtools__pill" id="bsb-devtools-pill" data-wp-bind--hidden="state.devtools.open" data-wp-class--is-armed="state.devtoolsIsArmed" data-wp-on--click="actions.devtoolsToggleOpen" aria-expanded="false" data-wp-bind--aria-expanded="state.devtools.open" aria-controls="bsb-devtools-card">{$dev}</button>

		<div class="bsb-devtools__card" id="bsb-devtools-card" hidden data-wp-bind--hidden="!state.devtools.open">
			<div class="bsb-devtools__card-header">
				<span class="bsb-devtools__card-eyebrow">{$eyebrow}</span>
				<span class="bsb-devtools__card-armed" hidden data-wp-bind--hidden="!state.devtoolsIsArmed">{$armed}</span>
				<div class="bsb-devtools__card-actions">
					<button type="button" class="bsb-devtools__card-reset" data-wp-on--click="actions.devtoolsReset" aria-label="{$reset}"><svg class="bsb-devtools__card-reset-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>
					<button type="button" class="bsb-devtools__card-close" data-wp-on--click="actions.devtoolsToggleOpen" aria-label="{$close}">&times;</button>
				</div>
			</div>
			<div class="bsb-devtools__card-divider"></div>

			<div class="bsb-devtools__card-body">
				<div class="bsb-devtools__group">
					<div class="bsb-devtools__group-head">
						<span class="bsb-devtools__group-title">{$battery}</span>
					</div>
					<div class="bsb-devtools__group-divider"></div>

					<div class="bsb-devtools__group-body" data-wp-class--is-disabled="state.devtoolsIsSimRunning">
						<div class="bsb-devtools__seg" role="group" aria-label="{$charging_group}">
							<button type="button" class="bsb-devtools__seg-option" data-devtools-charging="system" data-wp-class--is-selected="state.devtoolsIsChargingSystem" data-wp-on--click="actions.devtoolsSetCharging" data-wp-bind--disabled="state.devtoolsIsSimRunning">{$system}</button>
							<button type="button" class="bsb-devtools__seg-option" data-devtools-charging="charging" data-wp-class--is-selected="state.devtoolsIsChargingOn" data-wp-on--click="actions.devtoolsSetCharging" data-wp-bind--disabled="state.devtoolsIsSimRunning">{$charging_choice}</button>
							<button type="button" class="bsb-devtools__seg-option" data-devtools-charging="discharging" data-wp-class--is-selected="state.devtoolsIsChargingOff" data-wp-on--click="actions.devtoolsSetCharging" data-wp-bind--disabled="state.devtoolsIsSimRunning">{$discharging}</button>
						</div>

						<div class="bsb-devtools__level" data-wp-class--is-inactive="!state.devtoolsIsLevelForced">
							<button type="button" class="bsb-devtools__seg-option" data-wp-class--is-selected="!state.devtoolsIsLevelForced" data-wp-on--click="actions.devtoolsResetLevel" data-wp-bind--disabled="state.devtoolsIsSimRunning">{$system}</button>
							<input type="range" min="0" max="100" step="5" aria-label="{$level}" data-wp-bind--value="state.devtoolsLevelPercent" data-wp-style----fill="state.devtoolsLevelFillPercent" data-wp-on--input="actions.devtoolsSetLevel" data-wp-bind--disabled="state.devtoolsIsSimRunning" />
							<span class="bsb-devtools__level-value" data-wp-text="state.devtoolsLevelFillPercent"></span>
						</div>
					</div>
				</div>

				<div class="bsb-devtools__group">
					<div class="bsb-devtools__group-head">
						<span class="bsb-devtools__group-title">{$discharge}</span>
					</div>
					<div class="bsb-devtools__group-divider"></div>

					<div class="bsb-devtools__group-body">
						<div class="bsb-devtools__sim-steppers" data-wp-class--is-disabled="state.devtoolsIsSimRunning">
							<div class="bsb-devtools__stepper-row">
								<span class="bsb-devtools__stepper-label">{$from}</span>
								<div class="bsb-devtools__stepper">
									<button type="button" class="bsb-devtools__stepper-btn" data-devtools-sim-field="from" data-step="-5" data-wp-on--click="actions.devtoolsStepSim" data-wp-bind--disabled="state.devtoolsIsSimRunning" aria-label="{$from_decrease}">&minus;</button>
									<span class="bsb-devtools__stepper-readout"><span data-wp-text="state.devtoolsSimFromDisplay"></span><span class="bsb-devtools__stepper-unit">{$percent_unit}</span></span>
									<button type="button" class="bsb-devtools__stepper-btn" data-devtools-sim-field="from" data-step="5" data-wp-on--click="actions.devtoolsStepSim" data-wp-bind--disabled="state.devtoolsIsSimRunning" aria-label="{$from_increase}">+</button>
								</div>
							</div>

							<div class="bsb-devtools__stepper-row">
								<span class="bsb-devtools__stepper-label">{$to}</span>
								<div class="bsb-devtools__stepper">
									<button type="button" class="bsb-devtools__stepper-btn" data-devtools-sim-field="to" data-step="-5" data-wp-on--click="actions.devtoolsStepSim" data-wp-bind--disabled="state.devtoolsIsSimRunning" aria-label="{$to_decrease}">&minus;</button>
									<span class="bsb-devtools__stepper-readout"><span data-wp-text="state.devtoolsSimToDisplay"></span><span class="bsb-devtools__stepper-unit">{$percent_unit}</span></span>
									<button type="button" class="bsb-devtools__stepper-btn" data-devtools-sim-field="to" data-step="5" data-wp-on--click="actions.devtoolsStepSim" data-wp-bind--disabled="state.devtoolsIsSimRunning" aria-label="{$to_increase}">+</button>
								</div>
							</div>

							<div class="bsb-devtools__stepper-row">
								<span class="bsb-devtools__stepper-label">{$duration}</span>
								<div class="bsb-devtools__stepper">
									<button type="button" class="bsb-devtools__stepper-btn" data-devtools-sim-field="minutes" data-step="-5" data-wp-on--click="actions.devtoolsStepSim" data-wp-bind--disabled="state.devtoolsIsSimRunning" aria-label="{$duration_decrease}">&minus;</button>
									<span class="bsb-devtools__stepper-readout"><span data-wp-text="state.devtoolsSimMinutesDisplay"></span><span class="bsb-devtools__stepper-unit">{$minutes_unit}</span></span>
									<button type="button" class="bsb-devtools__stepper-btn" data-devtools-sim-field="minutes" data-step="5" data-wp-on--click="actions.devtoolsStepSim" data-wp-bind--disabled="state.devtoolsIsSimRunning" aria-label="{$duration_increase}">+</button>
								</div>
							</div>
						</div>

						<button type="button" class="bsb-devtools__sim-toggle" data-wp-class--is-running="state.devtoolsIsSimRunning" data-wp-on--click="actions.devtoolsToggleSim" data-wp-bind--disabled="state.devtoolsIsSimStartBlocked">
							<span class="bsb-devtools__sim-toggle-text bsb-devtools__sim-toggle-text--start">{$start}</span>
							<span class="bsb-devtools__sim-toggle-text bsb-devtools__sim-toggle-text--stop">{$stop}</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
HTML;
	}
}
