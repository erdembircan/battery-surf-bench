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
 * one bounded sub-panel per tool. Today that is the battery-override group
 * only; a second tool is another group in the card body, not a rework.
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
	 *     @type string $dev_label            Raw label on the collapsed pill.
	 *     @type string $eyebrow_label         Raw card header eyebrow.
	 *     @type string $armed_label           Raw "override active" header text.
	 *     @type string $close_label           Raw accessible label for the close control.
	 *     @type string $battery_label         Raw battery group heading.
	 *     @type string $battery_enable_label  Raw accessible label for the battery enable switch.
	 *     @type string $charging_group_label  Raw accessible group label for the charging tri-state.
	 *     @type string $system_label          Raw label for the "follow system" charging choice.
	 *     @type string $charging_label        Raw label for the "force charging" choice.
	 *     @type string $discharging_label     Raw label for the "force discharging" choice.
	 *     @type string $level_label           Raw label for the level-override toggle.
	 * }
	 * @return string The panel markup.
	 */
	public function render( array $data = array() ): string {
		$dev             = esc_html( (string) ( $data['dev_label'] ?? '' ) );
		$eyebrow         = esc_html( (string) ( $data['eyebrow_label'] ?? '' ) );
		$armed           = esc_html( (string) ( $data['armed_label'] ?? '' ) );
		$close           = esc_attr( (string) ( $data['close_label'] ?? '' ) );
		$battery         = esc_html( (string) ( $data['battery_label'] ?? '' ) );
		$battery_enable  = esc_attr( (string) ( $data['battery_enable_label'] ?? '' ) );
		$charging_group  = esc_attr( (string) ( $data['charging_group_label'] ?? '' ) );
		$system          = esc_html( (string) ( $data['system_label'] ?? '' ) );
		$charging_choice = esc_html( (string) ( $data['charging_label'] ?? '' ) );
		$discharging     = esc_html( (string) ( $data['discharging_label'] ?? '' ) );
		$level           = esc_html( (string) ( $data['level_label'] ?? '' ) );

		return <<<HTML
<div class="bsb-devtools" data-wp-interactive="bsb/cockpit" data-wp-watch---devtools-persist="callbacks.devtoolsPersist">
	<div class="bsb-devtools__swap">
		<button type="button" class="bsb-devtools__pill" id="bsb-devtools-pill" data-wp-bind--hidden="state.devtools.open" data-wp-class--is-armed="state.devtoolsIsArmed" data-wp-on--click="actions.devtoolsToggleOpen" aria-expanded="false" data-wp-bind--aria-expanded="state.devtools.open" aria-controls="bsb-devtools-card">{$dev}</button>

		<div class="bsb-devtools__card" id="bsb-devtools-card" hidden data-wp-bind--hidden="!state.devtools.open">
			<div class="bsb-devtools__card-header">
				<span class="bsb-devtools__card-eyebrow">{$eyebrow}</span>
				<span class="bsb-devtools__card-armed" hidden data-wp-bind--hidden="!state.devtoolsIsArmed">{$armed}</span>
				<button type="button" class="bsb-devtools__card-close" data-wp-on--click="actions.devtoolsToggleOpen" aria-label="{$close}">&times;</button>
			</div>
			<div class="bsb-devtools__card-divider"></div>

			<div class="bsb-devtools__card-body">
				<div class="bsb-devtools__group">
					<div class="bsb-devtools__group-head">
						<span class="bsb-devtools__group-title">{$battery}</span>
						<span class="bsb-devtools__switch">
							<input type="checkbox" aria-label="{$battery_enable}" data-wp-on--change="actions.devtoolsToggleBatteryEnabled" data-wp-bind--checked="state.devtools.battery.enabled" />
							<span class="bsb-devtools__switch-track">
								<span class="bsb-devtools__switch-knob"></span>
							</span>
						</span>
					</div>
					<div class="bsb-devtools__group-divider"></div>

					<div class="bsb-devtools__group-body" data-wp-class--is-muted="!state.devtools.battery.enabled">
						<div class="bsb-devtools__seg" role="group" aria-label="{$charging_group}">
							<button type="button" class="bsb-devtools__seg-option" data-devtools-charging="system" data-wp-class--is-selected="state.devtoolsIsChargingSystem" data-wp-on--click="actions.devtoolsSetCharging">{$system}</button>
							<button type="button" class="bsb-devtools__seg-option" data-devtools-charging="charging" data-wp-class--is-selected="state.devtoolsIsChargingOn" data-wp-on--click="actions.devtoolsSetCharging">{$charging_choice}</button>
							<button type="button" class="bsb-devtools__seg-option" data-devtools-charging="discharging" data-wp-class--is-selected="state.devtoolsIsChargingOff" data-wp-on--click="actions.devtoolsSetCharging">{$discharging}</button>
						</div>

						<label class="bsb-devtools__toggle-row">
							<span class="bsb-devtools__switch bsb-devtools__switch--sm">
								<input type="checkbox" data-wp-on--change="actions.devtoolsToggleLevel" data-wp-bind--checked="state.devtoolsIsLevelForced" />
								<span class="bsb-devtools__switch-track">
									<span class="bsb-devtools__switch-knob"></span>
								</span>
							</span>
							{$level}
						</label>

						<div class="bsb-devtools__level">
							<input type="range" min="0" max="100" data-wp-bind--value="state.devtoolsLevelPercent" data-wp-style----fill="state.devtoolsLevelFillPercent" data-wp-on--input="actions.devtoolsSetLevel" />
							<span class="bsb-devtools__level-value" data-wp-text="state.devtoolsLevelFillPercent"></span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
HTML;
	}
}
