import { Component, Input } from '@angular/core';
import { Option } from '../../../../shared/interface/theme-option.interface';
import { Footer } from '../../../../shared/interface/theme.interface';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-basic-footer',
  templateUrl: './basic-footer.component.html',
  styleUrls: ['./basic-footer.component.scss']
})
export class BasicFooterComponent {

  @Input() data: Option | null;
  @Input() footer: Footer;

  public active: { [key: string]: boolean } = {
    categories: false,
    useful_link: false,
    help_center: false
  };

  subscribeForm: FormGroup;
  submitted = false;
  subscribeSuccess = false;
  subscribeError = '';

  constructor(private fb: FormBuilder) {
    this.subscribeForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  toggle(value: string){
    this.active[value] = !this.active[value];
  }

  onSubscribe() {
    this.submitted = true;
    this.subscribeSuccess = false;
    this.subscribeError = '';
    
    if (this.subscribeForm.valid) {
      // Here you would typically call a service to handle the subscription
      // For demo purposes, we'll simulate a successful subscription
      setTimeout(() => {
        this.subscribeSuccess = true;
        this.subscribeForm.reset();
        this.submitted = false;
      }, 1000);
    } else {
      this.subscribeError = 'Please enter a valid email address.';
    }
  }

  get emailControl() {
    return this.subscribeForm.get('email');
  }
}
