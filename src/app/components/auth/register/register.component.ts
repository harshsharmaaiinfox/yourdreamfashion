import { Component } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { Store, Select } from '@ngxs/store';
import { Observable } from 'rxjs';
import { CustomValidators } from '../../../shared/validator/password-match';
import { Register } from '../../../shared/action/auth.action';
import { Breadcrumb } from '../../../shared/interface/breadcrumb';
import { SettingState } from '../../../shared/state/setting.state';
import { ThemeOptionState } from '../../../shared/state/theme-option.state';
import { Option } from '../../../shared/interface/theme-option.interface';
import { Values } from '../../../shared/interface/setting.interface';
import * as data from '../../../shared/data/country-code';
import { NotificationService } from '../../../shared/services/notification.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {

  @Select(SettingState.setting) setting$: Observable<Values>;
  @Select(ThemeOptionState.themeOptions) themeOption$: Observable<Option>;

  public form: FormGroup;
  public breadcrumb: Breadcrumb = {
    title: "Sign In",
    items: [{ label: 'Sign In', active: true }]
  }
  public codes = data.countryCodes;
  public tnc = new FormControl(false, [Validators.requiredTrue]);

  public reCaptcha: boolean = true;

  // Custom validator for name field - only letters and spaces allowed
  private nameValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }
    const namePattern = /^[a-zA-Z\s]+$/;
    return namePattern.test(control.value) ? null : { invalidName: true };
  }

  // Method to prevent special characters and numbers on input
  public onNameInput(event: any): void {
    const input = event.target;
    const value = input.value;
    const filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.form.get('name')?.setValue(filteredValue, { emitEvent: false });
    }
  }
  

  constructor(
    private store: Store,
    private router: Router,
    private formBuilder: FormBuilder,
    private notificationService: NotificationService
  ) {
    this.form = this.formBuilder.group({
      name: new FormControl('', [Validators.required, this.nameValidator.bind(this)]),
      email: new FormControl('', [Validators.required, Validators.email]),
      phone: new FormControl('', [Validators.required, Validators.pattern(/^[0-9]*$/)]),
      country_code: new FormControl('91', [Validators.required]),
      password: new FormControl('', [Validators.required]),
      password_confirmation: new FormControl('', [Validators.required]),
      recaptcha: new FormControl(null, Validators.required)
    },{validator : CustomValidators.MatchValidator('password', 'password_confirmation')});

    this.setting$.subscribe(seting => {
      if((seting?.google_reCaptcha && !seting?.google_reCaptcha?.status) || !seting?.google_reCaptcha) {
        this.form.removeControl('recaptcha');
        this.reCaptcha = false;
      } else {
        this.form.setControl('recaptcha', new FormControl(null, Validators.required))
        this.reCaptcha = true;
      }
    });

    this.form.get('country_code')?.disable();
    this.form.controls['phone']?.valueChanges.subscribe((value) => {
      if(value && value.toString().length < 10) {
        this.form.controls['phone'].markAsTouched();
        this.form.controls['phone'].setErrors({invalid: true});
      }
      if(value && value.toString().length > 10) {
        this.form.controls['phone']?.setValue(+value.toString().slice(0, 10), { emitEvent: false });
      }
      if(value && value.toString().length === 10) {
        this.form.controls['phone'].setErrors(null);
      }
    });

  }

  get passwordMatchError() {
    return (
      this.form.getError('mismatch') &&
      this.form.get('password_confirmation')?.touched
    );
  }

  submit() {
    this.form.markAllAsTouched();
    if(this.tnc.invalid){
      return
    }
    if(this.form.valid) {
      this.store.dispatch(new Register(this.form.value)).subscribe({
          complete: () => {
            this.router.navigateByUrl('/');
          }
        }
      );
    }
  }
}
